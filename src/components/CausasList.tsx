// src/components/CausasList.tsx
import React from 'react';
import type { AppConfig } from '../store/config';
import type { Causa } from '../types/causa';

interface Props {
  causas: Causa[];
  setCausas: React.Dispatch<React.SetStateAction<Causa[]>>;
  config: AppConfig;
  onToggleOrdenAuto: (val: boolean) => void;
}

export default function CausasList({ causas, setCausas, config, onToggleOrdenAuto }: Props) {
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= causas.length) return;
    setCausas(prev => {
      const copy = prev.slice();
      const tmp = copy[index];
      copy[index] = copy[j];
      copy[j] = tmp;
      return copy;
    });
  };

  return (
    <div className="p-3 border rounded-md bg-[#0f172a] text-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Causas</h3>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.ordenarAutomatico}
            onChange={e => onToggleOrdenAuto(e.target.checked)}
          />
          Ordenar automáticamente (más gravosa primero)
        </label>
      </div>

      {!config.ordenarAutomatico && (
        <p className="text-xs opacity-70 mb-2">
          Orden manual activo. El encadenado respetará el orden que ves.
        </p>
      )}

      <ul className="space-y-2">
        {causas.map((c, i) => (
          <li key={c.id} className="p-2 rounded bg-[#111827] border border-[#374151] flex items-center justify-between">
            <span className="text-sm">{i + 1}. {c.titulo}</span>

            {!config.ordenarAutomatico && (
              <span className="flex gap-1">
                <button
                  className="px-2 py-1 rounded bg-[#374151] hover:bg-[#4b5563]"
                  onClick={() => move(i, -1)}
                  title="Subir"
                >▲</button>
                <button
                  className="px-2 py-1 rounded bg-[#374151] hover:bg-[#4b5563]"
                  onClick={() => move(i, 1)}
                  title="Bajar"
                >▼</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}