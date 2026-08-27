import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type Ga4DailyInsight = {
  date: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
};

export class Ga4ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ga4ApiError";
  }
}

function toIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export async function fetchDailyMetrics({
  serviceAccountEmail,
  serviceAccountPrivateKey,
  propertyId,
  since,
  until,
}: {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  propertyId: string;
  since: string;
  until: string;
}): Promise<Ga4DailyInsight[]> {
  try {
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: serviceAccountPrivateKey,
      },
    });

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: since, endDate: until }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
        { name: "totalRevenue" },
      ],
    });

    return (response.rows ?? []).map((row) => ({
      date: toIsoDate(row.dimensionValues?.[0]?.value ?? ""),
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
      conversions: Number(row.metricValues?.[2]?.value ?? 0),
      revenue: Number(row.metricValues?.[3]?.value ?? 0),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Ga4ApiError(message);
  }
}
