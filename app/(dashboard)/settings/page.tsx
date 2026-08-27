import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Ga4CredentialForm } from "./ga4-credential-form";
import { GoogleAdsCredentialForm } from "./google-ads-credential-form";
import { MetaCredentialForm } from "./meta-credential-form";

export default async function SettingsPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;

  const credentials = organizationId
    ? await db.query.orgCredentials.findMany({
        where: (orgCredentials, { eq }) => eq(orgCredentials.organizationId, organizationId),
      })
    : [];

  const byPlatform = Object.fromEntries(credentials.map((c) => [c.platform, c]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Credenciales de organización para sincronizar plataformas publicitarias.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <MetaCredentialForm
          connected={!!byPlatform.meta}
          updatedAt={byPlatform.meta?.updatedAt ?? null}
        />
        <GoogleAdsCredentialForm
          connected={!!byPlatform.google_ads}
          updatedAt={byPlatform.google_ads?.updatedAt ?? null}
        />
        <Ga4CredentialForm
          connected={!!byPlatform.ga4}
          updatedAt={byPlatform.ga4?.updatedAt ?? null}
        />
      </div>
    </div>
  );
}
