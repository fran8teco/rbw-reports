import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "./index";
import { organizations, users } from "./schema";

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Definí ADMIN_EMAIL y ADMIN_PASSWORD antes de correr el seed.");
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: "Rainbow", slug: "rainbow" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  const organizationId =
    org?.id ??
    (
      await db.query.organizations.findFirst({
        where: (organizations, { eq }) => eq(organizations.slug, "rainbow"),
      })
    )?.id;

  if (!organizationId) throw new Error("No se pudo resolver la organización.");

  const passwordHash = await hash(password, 12);

  await db
    .insert(users)
    .values({
      organizationId,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin" },
    });

  console.log(`Usuario admin listo: ${email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
