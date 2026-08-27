import { GoogleAdsApi } from "google-ads-api";

// google-ads-api's own error handler crashes on any auth/transport error whose
// shape isn't a grpc-js Metadata object (e.g. an OAuth token exchange failure):
// it does `error.metadata.internalRepr.get(...)` with no guard on `internalRepr`,
// masking the real error behind "Cannot read properties of undefined (reading
// 'get')". Patch it at runtime — a pnpm patch to the node_modules source doesn't
// reliably survive the production build (Next's webpack cache keys the compiled
// module by package version, and a patch doesn't bump that).
let googleAdsErrorHandlerPatched = false;
async function ensureGoogleAdsErrorHandlerPatched() {
  if (googleAdsErrorHandlerPatched) return;
  googleAdsErrorHandlerPatched = true;

  const { Service } = await import("google-ads-api/build/src/service.js");
  const original = (Service.prototype as unknown as Record<string, (error: unknown) => unknown>)
    .getGoogleAdsError;

  (Service.prototype as unknown as Record<string, (error: unknown) => unknown>).getGoogleAdsError =
    function (this: unknown, error: unknown) {
      const internalRepr = (error as { metadata?: { internalRepr?: unknown } })?.metadata?.internalRepr as
        | { get?: unknown }
        | undefined;
      if (!internalRepr || typeof internalRepr.get !== "function") {
        return error;
      }
      return original.call(this, error);
    };
}

export type GoogleAdsDailyInsight = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export class GoogleAdsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

export async function fetchDailyMetrics({
  clientId,
  clientSecret,
  developerToken,
  refreshToken,
  loginCustomerId,
  customerId,
  since,
  until,
}: {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  loginCustomerId?: string;
  customerId: string;
  since: string;
  until: string;
}): Promise<GoogleAdsDailyInsight[]> {
  try {
    await ensureGoogleAdsErrorHandlerPatched();

    const api = new GoogleAdsApi({ client_id: clientId, client_secret: clientSecret, developer_token: developerToken });
    const customer = api.Customer({
      customer_id: customerId.replace(/-/g, ""),
      login_customer_id: loginCustomerId?.replace(/-/g, ""),
      refresh_token: refreshToken,
    });

    const rows = await customer.query(`
      SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
      FROM customer
      WHERE segments.date BETWEEN '${since}' AND '${until}'
    `);

    return rows.map((row) => ({
      date: String(row.segments?.date),
      spend: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    }));
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.stack ?? error.message}${"cause" in error ? ` | cause: ${String((error as { cause?: unknown }).cause)}` : ""}`
        : String(error);
    throw new GoogleAdsApiError(message);
  }
}
