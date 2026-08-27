import { and, eq } from "drizzle-orm";
import { decryptJson, type EncryptedPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { connectedAccounts, dailyMetricValues, orgCredentials, syncLogs } from "@/lib/db/schema";
import { fetchDailyMetrics, Ga4ApiError, type Ga4DailyInsight } from "@/lib/ga4/client";

type Ga4Credential = {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

const METRIC_KEYS: (keyof Omit<Ga4DailyInsight, "date">)[] = [
  "sessions",
  "users",
  "conversions",
  "revenue",
];

export async function syncGa4Account({
  connectedAccountId,
  since,
  until,
}: {
  connectedAccountId: string;
  since: string;
  until: string;
}): Promise<{ rowsSynced: number }> {
  const [log] = await db
    .insert(syncLogs)
    .values({ connectedAccountId, status: "running" })
    .returning();

  try {
    const account = await db.query.connectedAccounts.findFirst({
      where: eq(connectedAccounts.id, connectedAccountId),
      with: { client: true },
    });
    if (!account) throw new Error("Cuenta conectada no encontrada");
    if (account.platform !== "ga4") throw new Error("La cuenta no es de GA4");

    const credential = await db.query.orgCredentials.findFirst({
      where: and(
        eq(orgCredentials.organizationId, account.client.organizationId),
        eq(orgCredentials.platform, "ga4"),
      ),
    });
    if (!credential) throw new Error("No hay credencial de GA4 configurada para la organización");

    const { serviceAccountEmail, serviceAccountPrivateKey } = decryptJson<Ga4Credential>(
      credential.encryptedPayload as EncryptedPayload,
    );

    const insights = await fetchDailyMetrics({
      serviceAccountEmail,
      serviceAccountPrivateKey,
      propertyId: account.externalId,
      since,
      until,
    });

    let rowsSynced = 0;
    for (const day of insights) {
      for (const metricKey of METRIC_KEYS) {
        await db
          .insert(dailyMetricValues)
          .values({
            connectedAccountId,
            date: day.date,
            metricKey,
            value: day[metricKey].toString(),
          })
          .onConflictDoUpdate({
            target: [dailyMetricValues.connectedAccountId, dailyMetricValues.date, dailyMetricValues.metricKey],
            set: { value: day[metricKey].toString(), syncedAt: new Date() },
          });
        rowsSynced += 1;
      }
    }

    await db
      .update(connectedAccounts)
      .set({ status: "active", lastSyncedAt: new Date() })
      .where(eq(connectedAccounts.id, connectedAccountId));

    await db
      .update(syncLogs)
      .set({ status: "success", finishedAt: new Date() })
      .where(eq(syncLogs.id, log.id));

    return { rowsSynced };
  } catch (error) {
    const message = error instanceof Ga4ApiError ? error.message : String(error);

    await db
      .update(connectedAccounts)
      .set({ status: "error" })
      .where(eq(connectedAccounts.id, connectedAccountId));

    await db
      .update(syncLogs)
      .set({ status: "error", finishedAt: new Date(), errorMessage: message })
      .where(eq(syncLogs.id, log.id));

    throw error;
  }
}
