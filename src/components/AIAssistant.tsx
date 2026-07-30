"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Sparkles, X, Send, Mic } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  requiresConfirmation?: boolean
  pendingIntent?: string
  pendingParams?: Record<string, unknown>
  actionExecuted?: boolean
}

interface ApiResponse {
  message: string
  intent?: string
  params?: Record<string, unknown>
  requiresConfirmation?: boolean
  success?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] ?? "usuario"
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `¡Hola ${userName}! ¿En qué te ayudo? Puedo crear ofertas, registrar pagos, operaciones, encuestas y más.`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Detect Web Speech API support (browser-only)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setHasMic(!!SR)
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Actualizar el saludo cuando llega el nombre de sesión (si el usuario aún no chateó)
  useEffect(() => {
    setMessages(prev =>
      prev.length === 1 && prev[0].id === "welcome"
        ? [{ ...prev[0], content: `¡Hola ${userName}! ¿En qué te ayudo? Puedo crear ofertas, registrar pagos, operaciones, encuestas y más.` }]
        : prev,
    )
  }, [userName])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const buildHistory = (msgs: ChatMessage[]) =>
    msgs
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }))

  const makeId = () => Math.random().toString(36).slice(2)

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    setInput("")

    // Snapshot current messages before state update for history building
    const snapshot = messages

    // Expire any unresolved confirmations + append user message
    setMessages((prev) => {
      const expired = prev.map((m) =>
        m.requiresConfirmation && !m.actionExecuted ? { ...m, actionExecuted: true } : m
      )
      return [...expired, { id: makeId(), role: "user" as const, content: text }]
    })

    setIsLoading(true)

    // Build history from snapshot (excludes the message just sent)
    const history = buildHistory(
      snapshot.map((m) =>
        m.requiresConfirmation && !m.actionExecuted ? { ...m, actionExecuted: true } : m
      )
    )

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: { page: window.location.pathname },
        }),
      })

      const data: ApiResponse = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: data.message,
          requiresConfirmation: data.requiresConfirmation,
          pendingIntent: data.intent,
          pendingParams: data.params,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: "❌ Error de conexión. Intentá de nuevo." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Confirm action ────────────────────────────────────────────────────────

  const handleConfirm = async (
    messageId: string,
    intent: string,
    params: Record<string, unknown>
  ) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionExecuted: true } : m))
    )
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executeAction: { intent, params } }),
      })

      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: data.success ? data.message : `❌ ${data.message}`,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: "❌ Error al ejecutar la acción." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Cancel action ─────────────────────────────────────────────────────────

  const handleCancel = (messageId: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === messageId ? { ...m, actionExecuted: true } : m
      )
      return [
        ...updated,
        { id: makeId(), role: "assistant" as const, content: "Acción cancelada." },
      ]
    })
  }

  // ── Microphone ────────────────────────────────────────────────────────────

  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.lang = "es-AR"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript)
    }
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // La pantalla de login no lleva asistente (va después de todos los hooks)
  if (pathname === "/login") return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Abrir asistente IA"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: "#1E3A5F" }}
      >
        <Sparkles className="text-white" size={24} />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-40 flex flex-col rounded-2xl shadow-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden"
          style={{
            bottom: "5.5rem",
            right: "1rem",
            width: "min(90vw, 24rem)",
            height: "500px",
            backgroundColor: "#13131a",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: "#0f172a" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{
                  backgroundColor: "#1E3A5F",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                }}
              >
                IA
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">
                Asistente REMAX
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2 mt-1"
                    style={{ backgroundColor: "#1E3A5F" }}
                  >
                    IA
                  </div>
                )}

                <div className="max-w-[78%]">
                  <div
                    className={`px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === "user"
                        ? "text-white rounded-2xl rounded-br-sm ml-8"
                        : "rounded-2xl rounded-bl-sm"
                    }`}
                    style={{
                      backgroundColor: msg.role === "user" ? "#2563eb" : "rgba(255,255,255,0.10)",
                      color: msg.role === "user" ? undefined : "var(--crm-text)",
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Confirmation buttons */}
                  {msg.role === "assistant" &&
                    msg.requiresConfirmation &&
                    !msg.actionExecuted &&
                    msg.pendingIntent &&
                    msg.pendingParams && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() =>
                            handleConfirm(msg.id, msg.pendingIntent!, msg.pendingParams!)
                          }
                          disabled={isLoading}
                          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
                          style={{ backgroundColor: "#16a34a" }}
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => handleCancel(msg.id)}
                          disabled={isLoading}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-50 transition-opacity"
                          style={{ color: "#dc2626", borderColor: "#dc2626" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {isLoading && (
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: "#1E3A5F" }}
                >
                  IA
                </div>
                <div
                  className="px-3 py-2 rounded-2xl rounded-bl-sm text-sm flex items-center gap-1"
                  style={{ backgroundColor: "rgba(255,255,255,0.10)", color: "var(--crm-text-muted)" }}
                >
                  Pensando
                  <span className="flex gap-0.5 ml-1">
                    <span className="inline-block animate-bounce" style={{ animationDelay: "0ms" }}>
                      .
                    </span>
                    <span
                      className="inline-block animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    >
                      .
                    </span>
                    <span
                      className="inline-block animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    >
                      .
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-[rgba(255,255,255,0.1)] flex-shrink-0" style={{ backgroundColor: "#13131a" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Escribí tu mensaje..."
              disabled={isLoading}
              className="flex-1 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-transparent disabled:opacity-50"
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "var(--crm-text)" }}
            />
            {hasMic && (
              <button
                onClick={toggleMic}
                disabled={isLoading}
                aria-label={isRecording ? "Detener grabación" : "Grabar voz"}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50"
                style={{ backgroundColor: isRecording ? "#dc2626" : "rgba(255,255,255,0.08)" }}
              >
                <Mic
                  size={16}
                  style={{ color: isRecording ? "white" : "var(--crm-text-muted)" }}
                />
              </button>
            )}
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              aria-label="Enviar"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "#2563eb" }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
