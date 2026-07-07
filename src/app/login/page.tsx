import type { Metadata } from "next"
import LoginClient from "./LoginClient"

export const metadata: Metadata = {
  title: "Ingresar — REMAX Tradición CRM",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const params = await searchParams
  return <LoginClient error={params.error} callbackUrl={params.callbackUrl} />
}
