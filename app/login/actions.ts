"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as { cause?: { err?: { name?: string; code?: string } } }).cause?.err;
  return (
    error.name === "RateLimitError" ||
    (error as { code?: string }).code === "rate_limited" ||
    cause?.name === "RateLimitError" ||
    cause?.code === "rate_limited"
  );
}

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      return "Demasiados intentos. Esperá unos minutos e intentá de nuevo.";
    }
    if (error instanceof AuthError) {
      return "Email o contraseña incorrectos.";
    }
    throw error;
  }
}
