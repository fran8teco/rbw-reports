"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteGa4Credential, saveGa4Credential } from "./actions";

export function Ga4CredentialForm({
  connected,
  updatedAt,
}: {
  connected: boolean;
  updatedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveGa4Credential(formData);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <span className="font-medium">GA4 (Service Account)</span>
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
            <Label htmlFor="serviceAccountEmail">Client email</Label>
            <Input
              id="serviceAccountEmail"
              name="serviceAccountEmail"
              placeholder="xxx@xxx.iam.gserviceaccount.com"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serviceAccountPrivateKey">Private key</Label>
            <Textarea
              id="serviceAccountPrivateKey"
              name="serviceAccountPrivateKey"
              placeholder="-----BEGIN PRIVATE KEY-----..."
              rows={5}
              className="font-mono text-xs"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ambos valores están en el JSON que descargás al crear la clave del service account.
            Se cifra antes de guardarse. Compartí la propiedad de GA4 de cada cliente con este
            email (rol Viewer).
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
                  if (!confirm("¿Desconectar GA4? Los syncs dejarán de funcionar.")) return;
                  startTransition(() => deleteGa4Credential());
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
