import { useEffect, useState } from "react";
import FeedbackPanel from "./FeedbackPanel";

type Props = {
  gasUrl: string;
  /** Texto del botón flotante. Por defecto: "Comentarios". */
  label?: string;
  /** Función para obtener snapshot técnico (TO/TM/TMBI/TM CET, régimen, causas, etc.). */
  getSnapshot?: () => any;
};

export default function FeedbackSlideOver({ gasUrl, label = "Comentarios", getSnapshot }: Props) {
  const [open, setOpen] = useState(false);

  // Cierre con tecla ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Botón flotante moderno */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir comentarios"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 1040,
          border: "none",
          borderRadius: 999,
          padding: "10px 14px",
          background: "#111827", // negro suave
          color: "#fff",
          boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
          cursor: "pointer",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span aria-hidden>💬</span>
        <span style={{ fontWeight: 600 }}>{label}</span>
      </button>

      {/* Slide-over */}
      {open && (
        <div style={{ position: "fixed", inset: 0 as any, zIndex: 1050 }}>
          {/* backdrop */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(1px)",
            }}
          />
          {/* panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Formulario de comentarios"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              height: "100%",
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              boxShadow: "-12px 0 30px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden>💡</span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Envíanos tus comentarios</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>

            {/* contenido */}
            <div style={{ padding: 12, overflowY: "auto" }}>
              <FeedbackPanel gasUrl={gasUrl} getSnapshot={getSnapshot} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}