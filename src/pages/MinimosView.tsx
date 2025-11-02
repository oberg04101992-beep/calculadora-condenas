// src/pages/MinimosView.tsx
import React, { useMemo, useState } from "react";
import { calcularMinimos } from "../core/minimos";
import ResultadosMinimos from "../components/ResultadosMinimos";
import CausasList from "../components/CausasList";
import OpcionesAvanzadas from "../components/OpcionesAvanzadas";
import PanelComoSeCalculo from "../components/PanelComoSeCalculo";
import { defaultConfig } from "../store/config";
import type { Causa } from "../types/causa";

export default function MinimosView() {
  const [config, setConfig] = useState(defaultConfig);

  const [causas, setCausas] = useState<Causa[]>([
    { id: "c1", titulo: "Causa 1: 7 años", diasInclusivos: 2557 },
    { id: "c2", titulo: "Causa 2: 7 años", diasInclusivos: 2558 },
  ]);

  const [inicio, setInicio] = useState<Date>(new Date(Date.UTC(2021, 5, 17)));

  const diasBrutos = useMemo(
    () => causas.reduce((acc, c) => acc + c.diasInclusivos, 0),
    [causas]
  );

  const params = {
    inicio,
    diasBrutos,
    abonoMinimos: config.abonoMinimosGlobal,
    regimen: config.regimen,
    vistaOficial: config.vistaOficial,
    roundingMode: config.roundingMode
  } as const;

  const result = useMemo(() => calcularMinimos(params), [JSON.stringify(params)]);

  const box: React.CSSProperties = { margin: "12px 0", padding: 8, border: "1px solid #e5e7eb", borderRadius: 6 };
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, marginBottom: 4, display: "block" };
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

  return (
    <div style={{ fontSize: 14 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 12px" }}>Mínimos (modo sistema)</h2>

      <div style={box}>
        <div style={row}>
          <div>
            <label style={label}>Inicio</label>
            <input
              type="date"
              value={`${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, "0")}-${String(inicio.getUTCDate()).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setInicio(new Date(Date.UTC(y, m - 1, d)));
              }}
            />
          </div>
          <div>
            <label style={label}>Régimen</label>
            <select
              value={config.regimen}
              onChange={(e) => setConfig((c) => ({ ...c, regimen: e.target.value as any }))}
            >
              <option value="1/2">1/2</option>
              <option value="2/3">2/3</option>
            </select>
          </div>
          <div>
            <label style={label}>Vista de mínimos</label>
            <select
              value={config.vistaOficial ? "oficial" : "doctrinal"}
              onChange={(e) => setConfig((c) => ({ ...c, vistaOficial: e.target.value === "oficial" }))}
            >
              <option value="oficial">Oficial (exclusiva)</option>
              <option value="doctrinal">Doctrinal</option>
            </select>
          </div>
        </div>
      </div>

      <div style={box}>
        <CausasList
          causas={causas}
          setCausas={setCausas}
          config={config}
          onToggleOrdenAuto={(val) => setConfig((c) => ({ ...c, ordenarAutomatico: val }))}
        />
      </div>

      <OpcionesAvanzadas
        config={config}
        onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
      />

      <div style={box}>
        <ResultadosMinimos result={result} config={config} />
      </div>

      {/* Panel integrado: paso a paso */}
      <PanelComoSeCalculo
        inicio={inicio}
        diasBrutos={diasBrutos}
        abonoMinimos={config.abonoMinimosGlobal}
        regimen={config.regimen}
        vistaOficial={config.vistaOficial}
        roundingMode={config.roundingMode}
      />
    </div>
  );
}