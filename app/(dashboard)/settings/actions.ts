"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { orgCredentials } from "@/lib/db/schema";

export async function saveMetaCredential(formData: FormData) {
  const session = await auth();
  if (!session?.user?.organizationId) throw new Error("No autenticado");

  const accessToken = (formData.get("accessToken") as string | null)?.trim();
  if (!accessToken) throw new Error("El token es obligatorio");

  const encryptedPayload = encryptJson({ accessToken });

  await db
    .insert(orgCredentials)
    .values({
      organizationId: session.user.organizationId,
      platform: "meta",
      encryptedPayload,
    })
    .onConflictDoUpdate({
      target: [orgCredentials.organizationId, orgCredentials.platform],
      set: { encryptedPayload, updatedAt: new Date() },
    });

  revalidatePath("/settings");
}

export async function deleteMetaCredential() {
  const session = await auth();
  if (!session?.user?.organizationId) throw new Error("No autenticado");

  await db
    .delete(orgCredentials)
    .where(
      and(
        eq(orgCredentials.organizationId, session.user.organizationId),
        eq(orgCredentials.platform, "meta"),
      ),
    );

  revalidatePath("/settings");
}
