import { and, eq } from "drizzle-orm";
import { decryptJson, type EncryptedPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { connectedAccounts, dailyMetricValues, orgCredentials, syncLogs } from "@/lib/db/schema";
import { fetchDailyMetrics, GoogleAdsApiError, type GoogleAdsDailyInsight } from "@/lib/google-ads/client";

type GoogleAdsCredential = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string;
};

const METRIC_KEYS: (keyof Omit<GoogleAdsDailyInsight, "date">)[] = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
];

export async function syncGoogleAdsAccount({
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
    if (account.platform !== "google_ads") throw new Error("La cuenta no es de Google Ads");

    const credential = await db.query.orgCredentials.findFirst({
      where: and(
        eq(orgCredentials.organizationId, account.client.organizationId),
        eq(orgCredentials.platform, "google_ads"),
      ),
    });
    if (!credential) throw new Error("No hay credencial de Google Ads configurada para la organización");

    const { clientId, clientSecret, developerToken, refreshToken, loginCustomerId } = decryptJson<
      GoogleAdsCredential
    >(credential.encryptedPayload as EncryptedPayload);

    const insights = await fetchDailyMetrics({
      clientId,
      clientSecret,
      developerToken,
      refreshToken,
      loginCustomerId,
      customerId: account.externalId,
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
    const message = error instanceof GoogleAdsApiError ? error.message : String(error);

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
