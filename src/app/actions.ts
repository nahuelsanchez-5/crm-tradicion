"use server"
import { signIn, signOut } from "@/auth"

export async function handleGoogleSignIn() {
  await signIn("google", { redirectTo: "/" })
}

export async function handleSignOut() {
  await signOut({ redirectTo: "/login" })
}
