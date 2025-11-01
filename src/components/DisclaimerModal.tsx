import React from "react";

export default function DisclaimerModal() {
  // Bloqueante: siempre parte abierto. Puedes añadir “no volver a mostrar” si quieres.
  const [open, setOpen] = React.useState<boolean>(true);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(680px, 96vw)",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,.2)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
          Aviso importante
        </div>
        <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.55 }}>
          Esta herramienta es de apoyo. Verifique los resultados con la normativa
          vigente y los antecedentes del expediente. El cómputo usa días
          inclusivos y UTC; la vista de mínimos puede ser oficial (exclusiva) o
          doctrinal (inclusiva), según selecciones.
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}