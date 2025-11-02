// src/pages/MinimosView.tsx
import React, { useMemo, useState } from 'react';
import { calcularMinimos } from '../core/minimos';
import OpcionesAvanzadas from '../components/OpcionesAvanzadas';
import PanelCalculo from '../components/PanelCalculo';
import ResultadosMinimos from '../components/ResultadosMinimos';
import CausasList from '../components/CausasList';
import AnalisisRapido from '../components/AnalisisRapido';
import { defaultConfig } from '../store/config';
import type { Causa } from '../types/causa';

export default function MinimosView() {
  const [config, setConfig] = useState(defaultConfig);

  const [causas, setCausas] = useState<Causa[]>([
    { id: 'c1', titulo: 'Causa 1: 7 años', diasInclusivos: 2557 },
    { id: 'c2', titulo: 'Causa 2: 7 años', diasInclusivos: 2558 },
  ]);

  const [inicio, setInicio] = useState<Date>(new Date(Date.UTC(2021, 5, 17))); // 17/06/2021

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

  return (
    <div className="max-w-3xl mx-auto p-3 space-y-3">
      <h2 className="text-xl font-semibold text-white">Mínimos (modo sistema)</h2>

      {/* Config rápida */}
      <div className="p-3 border rounded-md bg-[#0f172a] text-white">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Inicio</label>
            <input
              type="date"
              className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374151]"
              value={`${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth()+1).padStart(2,'0')}-${String(inicio.getUTCDate()).padStart(2,'0')}`}
              onChange={e=>{
                const [y,m,d] = e.target.value.split('-').map(Number);
                setInicio(new Date(Date.UTC(y, m-1, d)));
              }}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Régimen</label>
            <select
              className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374151]"
              value={config.regimen}
              onChange={e => setConfig(c => ({ ...c, regimen: e.target.value as any }))}
            >
              <option value="1/2">1/2</option>
              <option value="2/3">2/3</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Vista de mínimos</label>
            <select
              className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374151]"
              value={config.vistaOficial ? 'oficial' : 'doctrinal'}
              onChange={e => setConfig(c => ({ ...c, vistaOficial: e.target.value === 'oficial' }))}
            >
              <option value="oficial">Oficial (exclusiva)</option>
              <option value="doctrinal">Doctrinal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Causas + orden */}
      <CausasList
        causas={causas}
        setCausas={setCausas}
        config={config}
        onToggleOrdenAuto={(val)=> setConfig(c=>({ ...c, ordenarAutomatico: val }))}
      />

      {/* Opciones avanzadas */}
      <OpcionesAvanzadas
        config={config}
        onChange={(patch) => setConfig(c => ({ ...c, ...patch }))}
      />

      {/* Resultados */}
      <ResultadosMinimos result={result} config={config} />

      {/* Análisis rápido (semáforo) */}
      <AnalisisRapido params={{ ...params, diasBrutos }} result={result} />

      {/* Panel cálculo con Copiar */}
      <PanelCalculo params={{ ...params, diasBrutos }} result={result} />
    </div>
  );
}