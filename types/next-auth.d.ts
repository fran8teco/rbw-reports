import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "admin" | "editor";
    organizationId: string;
  }

  interface Session {
    user: {
      role: "admin" | "editor";
      organizationId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "editor";
    organizationId: string;
  }
}
