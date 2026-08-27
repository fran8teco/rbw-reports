"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { orgCredentials, platform as platformEnum } from "@/lib/db/schema";

type Platform = (typeof platformEnum.enumValues)[number];

async function requireOrganizationId() {
  const session = await auth();
  if (!session?.user?.organizationId) throw new Error("No autenticado");
  return session.user.organizationId;
}

async function saveCredential(platform: Platform, payload: object) {
  const organizationId = await requireOrganizationId();
  const encryptedPayload = encryptJson(payload);

  await db
    .insert(orgCredentials)
    .values({ organizationId, platform, encryptedPayload })
    .onConflictDoUpdate({
      target: [orgCredentials.organizationId, orgCredentials.platform],
      set: { encryptedPayload, updatedAt: new Date() },
    });

  revalidatePath("/settings");
}

async function deleteCredential(platform: Platform) {
  const organizationId = await requireOrganizationId();

  await db
    .delete(orgCredentials)
    .where(and(eq(orgCredentials.organizationId, organizationId), eq(orgCredentials.platform, platform)));

  revalidatePath("/settings");
}

export async function saveMetaCredential(formData: FormData) {
  const accessToken = (formData.get("accessToken") as string | null)?.trim();
  if (!accessToken) throw new Error("El token es obligatorio");
  await saveCredential("meta", { accessToken });
}

export async function deleteMetaCredential() {
  await deleteCredential("meta");
}

export async function saveGoogleAdsCredential(formData: FormData) {
  const clientId = (formData.get("clientId") as string | null)?.trim();
  const clientSecret = (formData.get("clientSecret") as string | null)?.trim();
  const developerToken = (formData.get("developerToken") as string | null)?.trim();
  const refreshToken = (formData.get("refreshToken") as string | null)?.trim();
  const loginCustomerId = (formData.get("loginCustomerId") as string | null)?.trim();

  if (!clientId || !clientSecret || !developerToken || !refreshToken) {
    throw new Error("Client ID, Client Secret, Developer Token y Refresh Token son obligatorios");
  }

  await saveCredential("google_ads", {
    clientId,
    clientSecret,
    developerToken,
    refreshToken,
    loginCustomerId: loginCustomerId || undefined,
  });
}

export async function deleteGoogleAdsCredential() {
  await deleteCredential("google_ads");
}

export async function saveGa4Credential(formData: FormData) {
  const serviceAccountEmail = (formData.get("serviceAccountEmail") as string | null)?.trim();
  const serviceAccountPrivateKey = (formData.get("serviceAccountPrivateKey") as string | null)?.trim();

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error("Email y clave privada del service account son obligatorios");
  }

  await saveCredential("ga4", { serviceAccountEmail, serviceAccountPrivateKey });
}

export async function deleteGa4Credential() {
  await deleteCredential("ga4");
}
