"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteGoogleAdsCredential, saveGoogleAdsCredential } from "./actions";

export function GoogleAdsCredentialForm({
  connected,
  updatedAt,
}: {
  connected: boolean;
  updatedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveGoogleAdsCredential(formData);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <span className="font-medium">Google Ads</span>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? "Conectado" : "Sin conectar"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {connected && updatedAt && (
          <p className="text-sm text-muted-foreground">
            Última actualización: {updatedAt.toLocaleString("es-UY")}
          </p>
        )}
        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">OAuth Client ID</Label>
            <Input id="clientId" name="clientId" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientSecret">OAuth Client Secret</Label>
            <Input id="clientSecret" name="clientSecret" type="password" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="developerToken">Developer Token</Label>
            <Input id="developerToken" name="developerToken" type="password" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refreshToken">Refresh Token</Label>
            <Input id="refreshToken" name="refreshToken" type="password" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loginCustomerId">
              Login Customer ID <span className="text-muted-foreground">(MCC, opcional)</span>
            </Label>
            <Input id="loginCustomerId" name="loginCustomerId" placeholder="1234567890" autoComplete="off" />
          </div>
          <p className="text-xs text-muted-foreground">
            Se cifra antes de guardarse. Nunca se muestra de nuevo en el panel.
          </p>
          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : connected ? "Reemplazar" : "Guardar"}
            </Button>
            {connected && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("¿Desconectar Google Ads? Los syncs dejarán de funcionar.")) return;
                  startTransition(() => deleteGoogleAdsCredential());
                }}
              >
                Desconectar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
