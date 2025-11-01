// src/components/ResultadosMinimos.tsx
import React from 'react';
import { fmt } from '../lib/fechas';
import type { MinimosResult } from '../core/minimos';
import type { AppConfig } from '../store/config';

interface Props {
  result: MinimosResult;
  config: AppConfig;
}

export default function ResultadosMinimos({ result, config }: Props) {
  const { TM_mostrado, TMBI, CET } = result;
  const badge = config.roundingMode !== 'oficial'
    ? <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-600">criterio distinto al oficial</span>
    : null;

  return (
    <div className="p-3 border rounded-md bg-[#111827] text-white">
      <div className="flex items-center">
        <h3 className="font-semibold">Mínimos (TM / TMBI / CET)</h3>
        {badge}
      </div>
      <div className="mt-2 grid gap-1 text-sm">
        <div><b>TM:</b> {fmt(TM_mostrado)}</div>
        <div><b>TMBI:</b> {fmt(TMBI)}</div>
        <div><b>CET:</b> {fmt(CET)}</div>
      </div>
    </div>
  );
}