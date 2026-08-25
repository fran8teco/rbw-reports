"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteClient } from "./actions";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`¿Eliminar a "${clientName}"? Esto no se puede deshacer.`)) return;
        startTransition(() => deleteClient(clientId));
      }}
    >
      Eliminar
    </Button>
  );
}
