// src/components/AbonosDistribucion.tsx
import React from "react";
import { causaLabel } from "../utils/causaLabel";

type Regimen = "1/2" | "2/3";
export type Causa = {
  id: string;
  anios: number;
  meses: number;
  dias: number;
  abonoCausa: number;
  regimen: Regimen;
  nombre?: string;
  // len puede venir adjunto desde el contenedor (opcional, solo UI)
  len?: number;
};

type EncadenadoMode = "dia_siguiente" | "mismo_dia";

type Props = {
  causas: Causa[];
  inicio: string; // DD/MM/AAAA
  encadenado: EncadenadoMode;
  onAbonoChange?: (id: string, nuevoAbono: number) => void;
};

export default function AbonosDistribucion({
  causas,
  onAbonoChange,
}: Props) {
  return (
    <div
      style={{
        border: "1px dashed #e5e7eb",
        borderRadius: 10,
        padding: 10,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        Ajusta la distribución de abonos por causa. Los cambios impactan
        inmediatamente en el cómputo general.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px,1fr) 120px 140px",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>Causa</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Abono actual</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Nuevo abono</div>

        {causas.map((c, idx) => {
          const rotulo = causaLabel(c, idx); // ← “Causa N — (nombre)”
          return (
            <React.Fragment key={c.id}>
              <div title={c.nombre || ""}>{rotulo}</div>
              <div>{c.abonoCausa}</div>
              <div>
                <input
                  type="number"
                  defaultValue={c.abonoCausa}
                  onChange={(e) =>
                    onAbonoChange?.(c.id, Math.max(0, Number(e.target.value)))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                  aria-label={`Nuevo abono para ${rotulo}`}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}