// src/components/OpcionesAvanzadas.tsx
import React from 'react';
import type { AppConfig } from '../store/config';

interface Props {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export default function OpcionesAvanzadas({ config, onChange }: Props) {
  return (
    <details className="p-3 border rounded-md mb-3 bg-[#0f172a] text-white">
      <summary className="cursor-pointer font-semibold">Opciones avanzadas</summary>

      <div className="mt-3 grid gap-3">
        <div>
          <label className="block text-sm mb-1">
            Abonos que afectan MÍNIMOS (global) <span className="opacity-70">(no afecta el Término Contable)</span>
          </label>
          <input
            type="number"
            className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374151]"
            value={config.abonoMinimosGlobal}
            onChange={e => onChange({ abonoMinimosGlobal: Number(e.target.value || 0) })}
            min={0}
          />
          <p className="text-xs opacity-70 mt-1">
            Estos abonos se aplican a TM/TMBI según el criterio del sistema. No mueven el término contable.
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1">Criterio de redondeo (fracciones)</label>
          <select
            className="w-full px-2 py-1 rounded bg-[#111827] border border-[#374151]"
            value={config.roundingMode}
            onChange={e => onChange({ roundingMode: e.target.value as any })}
          >
            <option value="oficial">Oficial (ceil)</option>
            <option value="pro_reo">Pro reo (floor)</option>
            <option value="matematico">Matemático (≥.5 arriba)</option>
          </select>
          <p className="text-xs opacity-70 mt-1">
            Si eliges un criterio distinto a “Oficial (ceil)”, se mostrará un aviso en los resultados.
          </p>
        </div>
      </div>
    </details>
  );
}