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
import { Switch } from "@/components/ui/switch";
import { createClient, updateClient } from "./actions";

type Client = {
  id: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
};

export function ClientFormDialog({ client }: { client?: Client }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (client) {
        await updateClient(client.id, formData);
      } else {
        await createClient(formData);
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={client ? "outline" : "default"} size={client ? "sm" : "default"} />}
      >
        {client ? "Editar" : "Nuevo cliente"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={client?.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="logoUrl">URL del logo</Label>
            <Input id="logoUrl" name="logoUrl" defaultValue={client?.logoUrl ?? ""} />
          </div>
          {client && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={client.active} />
              <Label htmlFor="active">Activo</Label>
            </div>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
