// src/components/AbonosDistribucion.tsx
import React from "react";

type Regimen = "1/2" | "2/3";
type EncadenadoMode = "dia_siguiente" | "mismo_dia";

export type Causa = {
  id: string;
  nombre?: string;
  anios: number;
  meses: number;
  dias: number;
  abonoCausa: number;
  regimen: Regimen;
};

type Props = {
  causas: Causa[];
  inicio: string; // se muestra como contexto; no se recalcula aquí
  encadenado: EncadenadoMode; // igual: contexto visual
  onAbonoChange: (id: string, nuevoAbono: number) => void;
};

const AbonosDistribucion: React.FC<Props> = ({
  causas,
  inicio,
  encadenado,
  onAbonoChange,
}) => {
  // Totales útiles (solo lectura)
  const totalAbonosPorCausa = React.useMemo(
    () =>
      Array.isArray(causas)
        ? causas.reduce((acc, c) => acc + Math.max(0, Number(c.abonoCausa || 0)), 0)
        : 0,
    [causas]
  );

  // Handlers
  const handleAbonoInput = (id: string, raw: string) => {
    const parsed = Math.max(0, Number((raw || "0").replace(/[^\d]/g, "")));
    onAbonoChange(id, parsed);
  };

  // UI de ayuda
  const badge = (text: string) => (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        color: "#111827",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
      title={text}
    >
      {text}
    </span>
  );

  return (
    <div>
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 12,
          color: "#374151",
        }}
      >
        {badge(`Inicio: ${inicio || "—"}`)}
        {badge(
          `Encadenado: ${
            encadenado === "dia_siguiente"
              ? "Oficial (día siguiente)"
              : "Doctrinal (mismo día)"
          }`
        )}
        {badge(`Causas: ${causas?.length ?? 0}`)}
        {badge(`Abonos por causa (total): ${totalAbonosPorCausa}`)}
      </div>

      {/* Tabla editable de abonos por causa */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px,1fr) 100px 100px 100px 140px 120px 120px",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>Causa</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Años</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Meses</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Días</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Régimen</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Abono por causa</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Abono (editar)</div>

        {Array.isArray(causas) && causas.length > 0 ? (
          causas.map((c) => (
            <React.Fragment key={c.id}>
              <div>{c.nombre || c.id}</div>
              <div>{c.anios}</div>
              <div>{c.meses}</div>
              <div>{c.dias}</div>
              <div>{c.regimen}</div>
              <div>{c.abonoCausa}</div>
              <div>
                <input
                  type="number"
                  min={0}
                  value={c.abonoCausa}
                  onChange={(e) => handleAbonoInput(c.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                  aria-label={`Editar abono para ${c.nombre || c.id}`}
                />
              </div>
            </React.Fragment>
          ))
        ) : (
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#6b7280" }}>
            No hay causas para distribuir abonos.
          </div>
        )}
      </div>

      {/* Pie de módulo */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
        Este módulo sólo edita los <b>abonos por causa</b>. El efecto sobre TO/TM/TMBI/CET
        se ve en las tarjetas de resultados del panel principal.
      </div>
    </div>
  );
};

export default AbonosDistribucion;