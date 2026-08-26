const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaDailyInsight = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type InsightsApiRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
};

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export async function fetchDailyInsights({
  accessToken,
  adAccountId,
  since,
  until,
  conversionActionType,
}: {
  accessToken: string;
  adAccountId: string;
  since: string;
  until: string;
  conversionActionType: string | null;
}): Promise<MetaDailyInsight[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "spend,impressions,clicks,actions",
  });

  const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const response = await fetch(`${BASE_URL}/${accountPath}/insights?${params.toString()}`);
  const body = await response.json();

  if (!response.ok) {
    throw new MetaApiError(
      body?.error?.message ?? `Meta API respondió ${response.status}`,
      body?.error?.code,
    );
  }

  const rows = (body.data ?? []) as InsightsApiRow[];

  return rows.map((row) => ({
    date: row.date_start,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions: conversionActionType
      ? Number(
          row.actions?.find((action) => action.action_type === conversionActionType)?.value ?? 0,
        )
      : 0,
  }));
}
