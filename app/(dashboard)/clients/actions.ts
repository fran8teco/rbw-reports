"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export async function createClient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.organizationId) throw new Error("No autenticado");

  const name = String(formData.get("name") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  if (!name) throw new Error("El nombre es obligatorio");

  await db.insert(clients).values({
    organizationId: session.user.organizationId,
    name,
    logoUrl: logoUrl || null,
  });

  revalidatePath("/clients");
}

export async function updateClient(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name) throw new Error("El nombre es obligatorio");

  await db
    .update(clients)
    .set({ name, logoUrl: logoUrl || null, active })
    .where(eq(clients.id, clientId));

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClient(clientId: string) {
  await db.delete(clients).where(eq(clients.id, clientId));
  revalidatePath("/clients");
}
