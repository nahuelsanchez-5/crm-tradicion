import Image from "next/image"
import { handleSignOut } from "@/app/actions"

export default function AccesoDenegadoPage() {
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
          textAlign: "center",
          padding: "48px 40px",
        }}
      >
        <Image
          src="/logo-sidebar-crema.png"
          alt="RE/MAX Tradición"
          width={130}
          height={55}
          priority
          style={{ marginBottom: "32px" }}
        />

        {/* Ícono de error */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(227,24,55,0.12)",
            border: "1px solid rgba(227,24,55,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#E31837" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "18px",
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.2px",
          }}
        >
          Sin acceso al CRM
        </h1>

        <p style={{ margin: "0 0 6px", fontSize: "13.5px", color: "rgba(255,255,255,0.5)" }}>
          Tu cuenta no tiene acceso al CRM Tradición.
        </p>
        <p style={{ margin: "0 0 32px", fontSize: "13.5px", color: "rgba(255,255,255,0.35)" }}>
          Contactá a{" "}
          <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Nahuel Sánchez</span>
          {" "}para solicitar acceso.
        </p>

        <form action={handleSignOut}>
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 20px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 150ms",
            }}
          >
            Volver al login
          </button>
        </form>
      </div>
    </main>
  )
}
