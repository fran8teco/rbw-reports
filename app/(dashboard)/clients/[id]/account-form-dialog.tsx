"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createConnectedAccount, updateConnectedAccount } from "./actions";

type ConnectedAccount = {
  id: string;
  platform: "meta" | "google_ads" | "ga4";
  externalId: string;
  displayName: string;
  timezone: string;
  currency: string;
  conversionActionType: string | null;
  status: "active" | "error" | "pending";
};

const platformLabels: Record<ConnectedAccount["platform"], string> = {
  meta: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "GA4",
};

const statusLabels: Record<ConnectedAccount["status"], string> = {
  active: "Activa",
  error: "Error",
  pending: "Pendiente",
};

export function AccountFormDialog({
  clientId,
  account,
}: {
  clientId: string;
  account?: ConnectedAccount;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (account) {
        await updateConnectedAccount(clientId, account.id, formData);
      } else {
        await createConnectedAccount(clientId, formData);
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={account ? "outline" : "default"} size={account ? "sm" : "default"} />
        }
      >
        {account ? "Editar" : "Nueva cuenta"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta conectada" : "Nueva cuenta conectada"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="platform">Plataforma</Label>
            <Select name="platform" defaultValue={account?.platform ?? "meta"}>
              <SelectTrigger id="platform" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(platformLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Nombre</Label>
            <Input id="displayName" name="displayName" defaultValue={account?.displayName} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="externalId">ID externo (ad_account_id / customer_id / property_id)</Label>
            <Input id="externalId" name="externalId" defaultValue={account?.externalId} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={account?.timezone ?? "America/Montevideo"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Moneda</Label>
              <Input id="currency" name="currency" defaultValue={account?.currency ?? "USD"} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="conversionActionType">
              Tipo de conversión <span className="text-muted-foreground">(solo Meta Ads)</span>
            </Label>
            <Input
              id="conversionActionType"
              name="conversionActionType"
              defaultValue={account?.conversionActionType ?? ""}
              placeholder="ej. offsite_conversion.fb_pixel_purchase"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Estado</Label>
            <Select name="status" defaultValue={account?.status ?? "pending"}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
