import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { handleGoogleSignIn } from "@/app/actions"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/")

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a1a0f 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#13131a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header con logo */}
        <div
          style={{
            padding: "40px 40px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Image
            src="/logo-sidebar-crema.png"
            alt="RE/MAX Tradición"
            width={160}
            height={67}
            priority
          />
          <p
            style={{
              marginTop: "20px",
              marginBottom: 0,
              fontSize: "13px",
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              letterSpacing: "0.02em",
            }}
          >
            Panel de gestión interno
          </p>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "32px 40px 40px" }}>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.3px",
              textAlign: "center",
            }}
          >
            Iniciar sesión
          </p>

          <form action={handleGoogleSignIn}>
            <button
              type="submit"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "13px 20px",
                background: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#1f2937",
                cursor: "pointer",
                transition: "opacity 150ms, box-shadow 150ms",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                fontFamily: "inherit",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.92" }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}
            >
              {/* Google logo SVG */}
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Ingresar con Google
            </button>
          </form>

          <p
            style={{
              marginTop: "20px",
              marginBottom: 0,
              fontSize: "11.5px",
              color: "rgba(255,255,255,0.25)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Acceso exclusivo para staff de RE/MAX Tradición
          </p>
        </div>
      </div>
    </main>
  )
}
