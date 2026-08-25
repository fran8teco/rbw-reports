import Link from "next/link";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
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
import { clients } from "@/lib/db/schema";
import { ClientFormDialog } from "./client-form-dialog";
import { DeleteClientButton } from "./delete-client-button";

export default async function ClientsPage() {
  const session = await auth();
  const orgClients = await db.query.clients.findMany({
    where: (clients, { eq }) => eq(clients.organizationId, session!.user.organizationId),
    orderBy: [desc(clients.createdAt)],
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <ClientFormDialog />
      </div>

      {orgClients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay clientes cargados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={client.active ? "default" : "secondary"}>
                    {client.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <ClientFormDialog client={client} />
                  <DeleteClientButton clientId={client.id} clientName={client.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
