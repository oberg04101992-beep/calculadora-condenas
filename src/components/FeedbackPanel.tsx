import { useState } from "react";

type Props = {
  gasUrl: string;
  /** Si se provee, al marcar la casilla se adjuntará este snapshot técnico al envío. */
  getSnapshot?: () => any;
};

export default function FeedbackPanel({ gasUrl, getSnapshot }: Props) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [comentario, setComentario] = useState("");
  const [incluirDatos, setIncluirDatos] = useState(false);
  const [estado, setEstado] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [website, setWebsite] = useState(""); // honeypot anti-spam

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (website) return; // bot
    const texto = comentario.trim();
    if (!texto) {
      setMsg("Por favor, escribe tu comentario.");
      return;
    }

    setEstado("sending");
    setMsg("");

    // payload base
    const payload: any = {
      nombre: nombre.trim(),
      correo: correo.trim(),
      comentario: texto,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      ts: new Date().toISOString(),
    };

    // adjuntar snapshot si corresponde
    try {
      if (incluirDatos && typeof getSnapshot === "function") {
        const snap = getSnapshot();
        payload.snapshot = snap;
      }
    } catch {
      // si falla, no bloqueamos el envío
    }

    // intento 1: fetch normal (con content-type simple para evitar preflight)
    try {
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Si responde JSON, lo validamos; si CORS bloquea lectura, igual marcamos OK por status 200
      try {
        const data = await res.json();
        if (data?.ok !== true && data?.status !== "ok") {
          // algunos GAS devuelven string plano; si no es {ok:true} lo consideramos OK igual
        }
      } catch {
        // no importa si no podemos leer el body
      }

      setEstado("ok");
      setMsg("¡Gracias! Tu comentario fue enviado correctamente.");
      setNombre("");
      setCorreo("");
      setComentario("");
      setIncluirDatos(false);
      return;
    } catch (e: any) {
      // intento 2: sendBeacon / no-cors (sin confirmación del servidor)
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "text/plain" });
        if (navigator.sendBeacon && navigator.sendBeacon(gasUrl, blob)) {
          setEstado("ok");
          setMsg("Enviado (sin confirmación del servidor). ¡Gracias!");
          setNombre("");
          setCorreo("");
          setComentario("");
          setIncluirDatos(false);
          return;
        }
      } catch {
        // seguimos a error
      }
      setEstado("error");
      setMsg(`No se pudo enviar. ${e?.message || ""}`.trim());
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden>🛠️</span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ayúdanos a mejorar</h3>
      </div>

      <p style={{ marginTop: 0, marginBottom: 12, color: "#374151", textAlign: "justify", lineHeight: 1.5 }}>
        Esta aplicación está en evolución y tu opinión es clave para seguir mejorándola.
        Comparte tus ideas, problemas o sugerencias. ¡Leemos todo!
      </p>

      <form onSubmit={enviar} noValidate style={{ display: "grid", gap: 10 }}>
        {/* Honeypot oculto */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          style={{ display: "none" }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            📝 Nombre (opcional)
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            📧 Correo electrónico (opcional)
          </label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
            💬 Comentario o sugerencia (obligatorio)
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Cuéntanos tu idea o comentario"
            required
            style={{
              width: "100%",
              height: 120,
              resize: "none",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </div>

        {typeof getSnapshot === "function" && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#374151" }}>
            <input
              type="checkbox"
              checked={incluirDatos}
              onChange={() => setIncluirDatos((v) => !v)}
            />
            Incluir datos técnicos del cálculo (opcional)
          </label>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="submit"
            disabled={estado === "sending"}
            style={{
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              opacity: estado === "sending" ? 0.7 : 1,
            }}
          >
            {estado === "sending" ? "Enviando…" : "Enviar comentario"}
          </button>
          {msg && (
            <span
              style={{
                fontSize: 13,
                color:
                  estado === "ok" ? "#16a34a" :
                  estado === "error" ? "#dc2626" :
                  "#374151",
              }}
            >
              {msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}