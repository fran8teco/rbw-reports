import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { ClientFormDialog } from "../client-form-dialog";
import { AccountFormDialog } from "./account-form-dialog";
import { DeleteAccountButton } from "./delete-account-button";

const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "GA4",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  pending: "secondary",
  error: "destructive",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await db.query.clients.findFirst({
    where: (clients, { eq }) => eq(clients.id, id),
  });
  if (!client) notFound();

  const accounts = await db.query.connectedAccounts.findMany({
    where: (connectedAccounts, { eq }) => eq(connectedAccounts.clientId, id),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/clients" className="text-sm text-muted-foreground hover:underline">
          ← Clientes
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <ClientFormDialog client={client} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Cuentas conectadas</h2>
          <AccountFormDialog clientId={client.id} />
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cuentas conectadas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>ID externo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{platformLabels[account.platform]}</TableCell>
                  <TableCell>{account.displayName}</TableCell>
                  <TableCell className="font-mono text-sm">{account.externalId}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[account.status]}>{account.status}</Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <AccountFormDialog clientId={client.id} account={account} />
                    <DeleteAccountButton
                      clientId={client.id}
                      accountId={account.id}
                      accountName={account.displayName}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
