import { and, eq, inArray } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { syncMetaAccount } from "@/lib/sync/meta";

export const DAILY_SYNC_QUEUE = "meta-sync-daily";
export const BACKFILL_QUEUE = "meta-backfill";
export const ENQUEUE_DAILY_QUEUE = "meta-enqueue-daily";

const BACKFILL_DAYS = 90;
const META_CONCURRENCY = 3;
const RETRY_OPTIONS = { retryLimit: 3, retryBackoff: true } as const;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function yesterdayInTimezone(timezone: string): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(yesterday);
}

export async function registerMetaJobs(boss: PgBoss) {
  await boss.createQueue(DAILY_SYNC_QUEUE);
  await boss.createQueue(BACKFILL_QUEUE);
  await boss.createQueue(ENQUEUE_DAILY_QUEUE);

  await boss.work<{ connectedAccountId: string }>(
    DAILY_SYNC_QUEUE,
    { batchSize: META_CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        const account = await db.query.connectedAccounts.findFirst({
          where: eq(connectedAccounts.id, job.data.connectedAccountId),
        });
        if (!account) continue;

        const date = yesterdayInTimezone(account.timezone);
        await syncMetaAccount({ connectedAccountId: account.id, since: date, until: date });
      }
    },
  );

  await boss.work<{ connectedAccountId: string }>(
    BACKFILL_QUEUE,
    { batchSize: META_CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        const until = new Date();
        const since = new Date(until.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
        await syncMetaAccount({
          connectedAccountId: job.data.connectedAccountId,
          since: isoDate(since),
          until: isoDate(until),
        });
      }
    },
  );

  await boss.work(ENQUEUE_DAILY_QUEUE, async () => {
    const accounts = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(eq(connectedAccounts.platform, "meta"), inArray(connectedAccounts.status, ["active", "error"])),
      );

    for (const account of accounts) {
      await boss.send(DAILY_SYNC_QUEUE, { connectedAccountId: account.id }, RETRY_OPTIONS);
    }
  });

  await boss.schedule(ENQUEUE_DAILY_QUEUE, "0 6 * * *", {}, { tz: "UTC" });
}

export async function enqueueMetaBackfill(boss: PgBoss, connectedAccountId: string) {
  await boss.send(BACKFILL_QUEUE, { connectedAccountId }, RETRY_OPTIONS);
}
