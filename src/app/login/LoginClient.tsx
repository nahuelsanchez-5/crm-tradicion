"use client"

import { useState } from "react"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { Loader2, ShieldX } from "lucide-react"

export default function LoginClient({
  error,
  callbackUrl,
}: {
  error?: string
  callbackUrl?: string
}) {
  const [loading, setLoading] = useState(false)
  const denied = error === "AccessDenied"

  const handleLogin = () => {
    setLoading(true)
    signIn("google", { callbackUrl: callbackUrl || "/" })
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--crm-surface-2)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <Image
          src="/logo-sidebar-crema.png"
          alt="REMAX Tradición"
          width={180}
          height={54}
          style={{ objectFit: "contain" }}
          priority
        />

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--crm-text)", margin: 0 }}>
            CRM Tradición
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginTop: "6px" }}>
            Acceso exclusivo para el staff de la oficina
          </p>
        </div>

        {denied && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
            }}
          >
            <ShieldX size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f87171", margin: 0 }}>
                Acceso denegado
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: "2px 0 0" }}>
                Esa cuenta de Google no está habilitada. Probá con otra cuenta o
                pedile acceso al administrador.
              </p>
            </div>
          </div>
        )}

        {error && !denied && (
          <div
            role="alert"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(251,191,36,0.1)",
              border: "1px solid rgba(251,191,36,0.3)",
              fontSize: "12px",
              color: "#fbbf24",
            }}
          >
            Ocurrió un error al iniciar sesión. Intentá de nuevo.
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            width: "100%",
            minHeight: "46px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: loading ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
            color: "var(--crm-text)",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: loading ? "default" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          {loading ? "Redirigiendo..." : "Ingresar con Google"}
        </button>
      </div>
    </div>
  )
}
