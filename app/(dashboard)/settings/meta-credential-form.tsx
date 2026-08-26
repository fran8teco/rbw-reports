"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMetaCredential, saveMetaCredential } from "./actions";

export function MetaCredentialForm({
  connected,
  updatedAt,
}: {
  connected: boolean;
  updatedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveMetaCredential(formData);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <span className="font-medium">Access token (System User)</span>
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
        <form action={handleSubmit} className="flex flex-col gap-2">
          <Label htmlFor="accessToken">Pegar token</Label>
          <Input
            id="accessToken"
            name="accessToken"
            type="password"
            placeholder="EAAG..."
            autoComplete="off"
            required
          />
          <p className="text-xs text-muted-foreground">
            Se cifra antes de guardarse. Nunca se muestra de nuevo en el panel.
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : connected ? "Reemplazar" : "Guardar"}
            </Button>
            {connected && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("¿Desconectar Meta Ads? Los syncs dejarán de funcionar.")) return;
                  startTransition(() => deleteMetaCredential());
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
