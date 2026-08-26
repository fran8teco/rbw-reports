import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MetaCredentialForm } from "./meta-credential-form";

export default async function SettingsPage() {
  const session = await auth();

  const credential = session?.user?.organizationId
    ? await db.query.orgCredentials.findFirst({
        where: (orgCredentials, { and, eq }) =>
          and(
            eq(orgCredentials.organizationId, session.user.organizationId),
            eq(orgCredentials.platform, "meta"),
          ),
      })
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Credenciales de organización para sincronizar plataformas publicitarias.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Meta Ads</h2>
        <MetaCredentialForm connected={!!credential} updatedAt={credential?.updatedAt ?? null} />
      </div>
    </div>
  );
}
