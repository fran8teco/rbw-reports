"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncConnectedAccountNow } from "./actions";

export function SyncAccountButton({ clientId, accountId }: { clientId: string; accountId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await syncConnectedAccountNow(clientId, accountId);
          if (result.ok) {
            toast.success(`Sync completo: ${result.rowsSynced} filas actualizadas`);
          } else {
            toast.error(`Error al sincronizar: ${result.message}`);
          }
        });
      }}
    >
      {isPending ? "Sincronizando..." : "Sincronizar ahora"}
    </Button>
  );
}
