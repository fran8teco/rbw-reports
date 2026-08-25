import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/30 p-4">
        <p className="mb-6 px-2 text-lg font-semibold">RBW Reports</p>
        <nav className="flex flex-col gap-1">
          <Link
            href="/clients"
            className="rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            Clientes
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </header>
        <Separator />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
