// src/components/DisclaimerModal.tsx
import React, { useState } from "react";

export default function DisclaimerModal() {
  // Mostrar SIEMPRE al abrir la app. Si se acaba de “restablecer”, no mostrar.
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const skip = sessionStorage.getItem("skipDisclaimerOnce");
      if (skip) {
        sessionStorage.removeItem("skipDisclaimerOnce");
        return false;
      }
    } catch {}
    return true;
  });

  if (!open) return null;

  const closeNow = () => setOpen(false);

  const goToDefinitions = () => {
    const def = document.getElementById(
      "definiciones"
    ) as HTMLDetailsElement | null;
    if (def) def.open = true;
    def?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2147483647,
        padding: 16,
      }}
      onClick={closeNow}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 12px 36px rgba(0,0,0,.22)",
          padding: 20,
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background:
                  "linear-gradient(135deg, rgba(59,130,246,.15), rgba(16,185,129,.15))",
                display: "grid",
                placeItems: "center",
                border: "1px solid #e5e7eb",
              }}
            >
              ⚖️
            </div>
            <h2
              id="disclaimer-title"
              style={{ margin: 0, fontSize: 18, fontWeight: 800 }}
            >
              Antes de usar la calculadora
            </h2>
          </div>

          <button
            aria-label="Cerrar"
            onClick={closeNow}
            style={{
              width: 30,
              height: 30,
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 8,
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            lineHeight: 1.55,
            color: "#374151",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Qué es esta herramienta
          </div>
          <div style={{ fontSize: 14 }}>
            Esta calculadora es una herramienta de <b>apoyo orientativo</b> para
            revisar cómputos del expediente de forma rápida. No reemplaza la
            revisión profesional, la normativa vigente ni los registros
            institucionales.
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            lineHeight: 1.55,
            color: "#374151",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Qué resultados entrega
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {[
              ["TO", "Fecha final de cumplimiento de la condena."],
              ["TM", "Fecha en que se cumple el mínimo exigido según el régimen."],
              ["TMBI", "Fecha de referencia para beneficio intrapenitenciario."],
              ["TM CET", "Fecha de control de ejecución que muestra la calculadora."],
            ].map(([sigla, detalle]) => (
              <div
                key={sigla}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "#fafafa",
                }}
              >
                <b>{sigla}:</b> {detalle}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #f59e0b",
            borderRadius: 12,
            padding: 12,
            lineHeight: 1.55,
            color: "#92400e",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Qué revisar siempre
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Normativa vigente aplicable al expediente.</li>
            <li>Registros institucionales y antecedentes de respaldo.</li>
            <li>Abonos cargados por causa y abono global, si corresponde.</li>
            <li>Contraste operativo o manual cuando exista duda sobre la fecha.</li>
          </ul>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <b>Calculadora de Cómputos de Condenas</b> · v1.0 · Creada por{" "}
            <b>Teniente Luis Ascencio Oberg</b>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={goToDefinitions}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Ver definiciones
            </button>
            <button
              onClick={closeNow}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Entiendo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
