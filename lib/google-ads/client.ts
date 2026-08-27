import { GoogleAdsApi } from "google-ads-api";

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
    const message = error instanceof Error ? error.message : String(error);
    throw new GoogleAdsApiError(message);
  }
}
