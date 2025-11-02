// src/components/AnalisisRapido.tsx
import React from 'react';
import { fmt } from '../lib/fechas';
import type { MinimosResult, MinimosParams } from '../core/minimos';

function inRange(d: Date, a: Date, b: Date) {
  const x = d.getTime(), x1 = a.getTime(), x2 = b.getTime();
  return x >= x1 && x <= x2;
}

interface Item {
  ok: boolean;
  label: string;
  detalle?: string;
}

interface Props {
  params: MinimosParams & { diasBrutos: number };
  result: MinimosResult;
}

export default function AnalisisRapido({ params, result }: Props) {
  const { inicio } = params;
  const { TM_mostrado, TMBI, CET } = result;

  const items: Item[] = [
    {
      ok: TMBI.getTime() < TM_mostrado.getTime(),
      label: 'TMBI es anterior a TM (coherencia mínima)',
      detalle: `TMBI ${fmt(TMBI)} < TM ${fmt(TM_mostrado)}`
    },
    {
      ok: inRange(CET, inicio, TMBI),
      label: 'CET dentro del tramo [Inicio, TMBI]',
      detalle: `CET ${fmt(CET)} ∈ [${fmt(inicio)}, ${fmt(TMBI)}]`
    }
  ];

  return (
    <div className="p-3 border rounded-md bg-[#0f172a] text-white">
      <h3 className="font-semibold mb-2">Análisis rápido</h3>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${it.ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{it.label}</span>
            <span className="opacity-70">— {it.detalle}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}