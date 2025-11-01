// src/components/PanelCalculo.tsx
import React, { useMemo } from 'react';
import { fmt } from '../lib/fechas';
import type { MinimosResult, MinimosParams } from '../core/minimos';

interface Props {
  params: MinimosParams & { diasBrutos: number };
  result: MinimosResult;
}

export default function PanelCalculo({ params, result }: Props) {
  const {
    inicio, diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode
  } = params;
  const {
    TM_inclusivo, TM_mostrado, TMd_raw, TMd_aplicado,
    TMBI, CET, CETd_raw, CETd_aplicado, tramo_TMBI_dias
  } = result;

  const textoEscrito = useMemo(() => {
    const f = regimen === '2/3' ? '2/3' : '1/2';
    return [
      `Cómputo escrito`,
      ``,
      `Datos`,
      `  Inicio (S): ${fmt(inicio)}`,
      `  Brutos (B): ${diasBrutos} días (inclusivo)`,
      `  Abonos que afectan mínimos (Amin): ${abonoMinimos} días`,
      `  Régimen (f): ${f}`,
      `  Vista de mínimos: ${vistaOficial ? 'Oficial (exclusiva)' : 'Doctrinal'}`,
      `  Criterio de redondeo: ${roundingMode}`,
      ``,
      `1) TM (mínimo) — Modo sistema`,
      `  Fórmula: TMd = ceil(B×f) − ceil(Amin×(1−f))`,
      `  TMd (fracción): ${TMd_raw.toString().replace('.', ',')}`,
      `  Entero aplicado: ${TMd_aplicado} (criterio: ${roundingMode})`,
      `  TM_inclusivo = S + (TMd − 1) = ${fmt(TM_inclusivo)}`,
      `  TM_mostrado (Oficial) = ${fmt(TM_mostrado)}`,
      ``,
      `2) TMBI`,
      `  TMBI = TM_mostrado − 12 meses (fin de mes) = ${fmt(TMBI)}`,
      ``,
      `3) CET`,
      `  D = díasInclusivos(S, TMBI) = ${tramo_TMBI_dias}`,
      `  CETd (fracción): ${CETd_raw.toString().replace('.', ',')}`,
      `  Entero aplicado CETd: ${CETd_aplicado} (criterio: ${roundingMode})`,
      `  CET = S + (CETd − 1) = ${fmt(CET)}`,
      ``,
      `Resultados`,
      `  TM: ${fmt(TM_mostrado)} · TMBI: ${fmt(TMBI)} · CET: ${fmt(CET)}`
    ].join('\n');
  }, [inicio, diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode,
      TM_inclusivo, TM_mostrado, TMd_raw, TMd_aplicado, TMBI, CET, CETd_raw, CETd_aplicado, tramo_TMBI_dias]);

  const copiar = async () => {
    await navigator.clipboard.writeText(textoEscrito);
    alert('Cálculo escrito copiado.');
  };

  return (
    <details className="p-3 border rounded-md bg-[#0f172a] text-white">
      <summary className="cursor-pointer font-semibold">¿Cómo se calculó?</summary>
      <div className="mt-3 text-sm space-y-1">
        <p><b>TMd (fracción):</b> {TMd_raw} → <b>entero aplicado:</b> {TMd_aplicado} ({roundingMode})</p>
        <p><b>TM_inclusivo:</b> {fmt(TM_inclusivo)} · <b>TM (mostrado):</b> {fmt(TM_mostrado)}</p>
        <p><b>TMBI:</b> {fmt(TMBI)}</p>
        <p><b>Días S→TMBI (incl.):</b> {tramo_TMBI_dias}</p>
        <p><b>CETd (fracción):</b> {CETd_raw} → <b>entero aplicado:</b> {CETd_aplicado} ({roundingMode})</p>
        <p><b>CET:</b> {fmt(CET)}</p>

        <button onClick={copiar}
          className="mt-3 px-3 py-1 rounded bg-[#2563eb] hover:bg-[#1d4ed8]">
          Copiar cálculo escrito
        </button>
      </div>
    </details>
  );
}