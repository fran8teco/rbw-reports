"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";

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
  await db.insert(connectedAccounts).values({ clientId, ...values });
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
