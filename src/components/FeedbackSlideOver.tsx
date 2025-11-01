// src/components/FeedbackSlideOver.tsx
import React, { useState } from "react";
import FeedbackPanel from "./FeedbackPanel";

type Props = { gasUrl: string };

export default function FeedbackSlideOver({ gasUrl }: Props) {
  const [open, setOpen] = useState(false);

  // ejemplo: snapshot opcional del estado de la UI
  const getSnapshot = () => {
    try {
      const raw = localStorage.getItem("calc_state_v6");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          padding: "10px 14px",
          borderRadius: 999,
          background: "#111827",
          color: "#fff",
          border: "1px solid #111827",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          cursor: "pointer",
          zIndex: 50,
        }}
        aria-label="Abrir panel de comentarios"
        title="Enviar comentario"
      >
        Comentarios
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 60,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 100%)",
              height: "100%",
              background: "#fff",
              borderLeft: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>Envíanos tu comentario</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* contenido */}
            <div style={{ padding: 12, overflowY: "auto" }}>
              <FeedbackPanel gasUrl={gasUrl} getSnapshot={getSnapshot} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}