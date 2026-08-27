"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { enqueueGa4Backfill } from "@/lib/jobs/ga4-sync";
import { enqueueGoogleAdsBackfill } from "@/lib/jobs/google-ads-sync";
import { enqueueMetaBackfill } from "@/lib/jobs/meta-sync";
import { syncGa4Account } from "@/lib/sync/ga4";
import { syncGoogleAdsAccount } from "@/lib/sync/google-ads";
import { syncMetaAccount } from "@/lib/sync/meta";

const BACKFILL_DAYS = 90;

function parseAccountForm(formData: FormData) {
  const platform = String(formData.get("platform") ?? "");
  const externalId = String(formData.get("externalId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "America/Montevideo";
  const currency = String(formData.get("currency") ?? "").trim() || "USD";
  const conversionActionType = String(formData.get("conversionActionType") ?? "").trim();
  const status = String(formData.get("status") ?? "pending");

  if (!["meta", "google_ads", "ga4"].includes(platform)) {
    throw new Error("Plataforma inválida");
  }
  if (!externalId || !displayName) {
    throw new Error("ID externo y nombre son obligatorios");
  }
  if (!["active", "error", "pending"].includes(status)) {
    throw new Error("Estado inválido");
  }

  return {
    platform: platform as "meta" | "google_ads" | "ga4",
    externalId,
    displayName,
    timezone,
    currency,
    conversionActionType: conversionActionType || null,
    status: status as "active" | "error" | "pending",
  };
}

export async function createConnectedAccount(clientId: string, formData: FormData) {
  const values = parseAccountForm(formData);
  const [account] = await db
    .insert(connectedAccounts)
    .values({ clientId, ...values })
    .returning();

  const boss = await getBoss();
  if (account.platform === "meta") {
    await enqueueMetaBackfill(boss, account.id);
  } else if (account.platform === "google_ads") {
    await enqueueGoogleAdsBackfill(boss, account.id);
  } else if (account.platform === "ga4") {
    await enqueueGa4Backfill(boss, account.id);
  }

  revalidatePath(`/clients/${clientId}`);
}

export async function updateConnectedAccount(
  clientId: string,
  accountId: string,
  formData: FormData,
) {
  const values = parseAccountForm(formData);
  await db.update(connectedAccounts).set(values).where(eq(connectedAccounts.id, accountId));
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteConnectedAccount(clientId: string, accountId: string) {
  await db.delete(connectedAccounts).where(eq(connectedAccounts.id, accountId));
  revalidatePath(`/clients/${clientId}`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function syncConnectedAccountNow(clientId: string, accountId: string) {
  const until = new Date();
  const since = new Date(until.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const range = { connectedAccountId: accountId, since: isoDate(since), until: isoDate(until) };

  try {
    const account = await db.query.connectedAccounts.findFirst({
      where: eq(connectedAccounts.id, accountId),
    });
    if (!account) throw new Error("Cuenta conectada no encontrada");

    const result =
      account.platform === "meta"
        ? await syncMetaAccount(range)
        : account.platform === "google_ads"
          ? await syncGoogleAdsAccount(range)
          : await syncGa4Account(range);

    revalidatePath(`/clients/${clientId}`);
    return { ok: true as const, rowsSynced: result.rowsSynced };
  } catch (error) {
    revalidatePath(`/clients/${clientId}`);
    return { ok: false as const, message: error instanceof Error ? error.message : String(error) };
  }
}
