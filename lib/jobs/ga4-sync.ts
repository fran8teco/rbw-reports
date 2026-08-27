import { and, eq, inArray } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { syncGa4Account } from "@/lib/sync/ga4";

export const DAILY_SYNC_QUEUE = "ga4-sync-daily";
export const BACKFILL_QUEUE = "ga4-backfill";
export const ENQUEUE_DAILY_QUEUE = "ga4-enqueue-daily";

const BACKFILL_DAYS = 90;
const CONCURRENCY = 5;
const RETRY_OPTIONS = { retryLimit: 3, retryBackoff: true } as const;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function yesterdayInTimezone(timezone: string): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(yesterday);
}

export async function registerGa4Jobs(boss: PgBoss) {
  await boss.createQueue(DAILY_SYNC_QUEUE);
  await boss.createQueue(BACKFILL_QUEUE);
  await boss.createQueue(ENQUEUE_DAILY_QUEUE);

  await boss.work<{ connectedAccountId: string }>(
    DAILY_SYNC_QUEUE,
    { batchSize: CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        const account = await db.query.connectedAccounts.findFirst({
          where: eq(connectedAccounts.id, job.data.connectedAccountId),
        });
        if (!account) continue;

        const date = yesterdayInTimezone(account.timezone);
        await syncGa4Account({ connectedAccountId: account.id, since: date, until: date });
      }
    },
  );

  await boss.work<{ connectedAccountId: string }>(
    BACKFILL_QUEUE,
    { batchSize: CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        const until = new Date();
        const since = new Date(until.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
        await syncGa4Account({
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
      .where(and(eq(connectedAccounts.platform, "ga4"), inArray(connectedAccounts.status, ["active", "error"])));

    for (const account of accounts) {
      await boss.send(DAILY_SYNC_QUEUE, { connectedAccountId: account.id }, RETRY_OPTIONS);
    }
  });

  await boss.schedule(ENQUEUE_DAILY_QUEUE, "20 6 * * *", {}, { tz: "UTC" });
}

export async function enqueueGa4Backfill(boss: PgBoss, connectedAccountId: string) {
  await boss.send(BACKFILL_QUEUE, { connectedAccountId }, RETRY_OPTIONS);
}
