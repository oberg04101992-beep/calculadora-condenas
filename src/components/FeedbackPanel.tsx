// src/components/FeedbackPanel.tsx
import React, { useState } from "react";

type Props = {
  gasUrl: string;
  getSnapshot?: () => any; // ← opcional, para compatibilidad con FeedbackSlideOver
};

export default function FeedbackPanel({ gasUrl, getSnapshot }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const enviar = async () => {
    if (!texto.trim()) {
      setErr("Escribe algún comentario.");
      setOk(null);
      return;
    }
    setErr(null);
    setOk(null);
    setEnviando(true);
    try {
      // opcionalmente adjuntamos snapshot si el padre lo provee
      const snapshot = typeof getSnapshot === "function" ? getSnapshot() : undefined;

      const payload = {
        comentario: texto,
        fechaIso: new Date().toISOString(),
        snapshot,
      };

      await fetch(gasUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOk("¡Gracias! Tu comentario fue enviado.");
      setTexto("");
    } catch (e: any) {
      setErr("No se pudo enviar. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Comentarios</div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Cuéntame qué mejorar o si algo falló…"
        rows={5}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #d1d5db",
          background: "#fff",
        }}
      />
      <div style={{ marginTop: 8 }}>
        <button
          onClick={enviar}
          disabled={enviando}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #0ea5e9",
            background: enviando ? "#93c5fd" : "#0ea5e9",
            color: "#fff",
            cursor: enviando ? "not-allowed" : "pointer",
          }}
        >
          {enviando ? "Enviando…" : "Enviar comentario"}
        </button>
      </div>
      {ok ? (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #16a34a",
            background: "#ecfdf5",
            color: "#065f46",
            fontSize: 12,
          }}
        >
          {ok}
        </div>
      ) : null}
      {err ? (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ef4444",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
}