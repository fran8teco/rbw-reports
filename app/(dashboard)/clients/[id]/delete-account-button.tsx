"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteConnectedAccount } from "./actions";

export function DeleteAccountButton({
  clientId,
  accountId,
  accountName,
}: {
  clientId: string;
  accountId: string;
  accountName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`¿Eliminar la cuenta "${accountName}"?`)) return;
        startTransition(() => deleteConnectedAccount(clientId, accountId));
      }}
    >
      Eliminar
    </Button>
  );
}
