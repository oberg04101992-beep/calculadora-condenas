// src/core/minimos.ts
import { addDaysUTC, addMonthsRespectingEOM, diasInclusivosUTC } from '../lib/fechas';

export type Regimen = '1/2' | '2/3';
export type RoundingMode = 'oficial' | 'pro_reo' | 'matematico';

export interface MinimosParams {
  inicio: Date;              // Inicio del cómputo (UTC)
  diasBrutos: number;        // Días inclusivos totales (encadenado ya resuelto)
  abonoMinimos: number;      // "Abonos que afectan mínimos (global)"
  regimen: Regimen;          // 1/2 o 2/3
  vistaOficial: boolean;     // true = vista "Oficial (exclusiva)"
  roundingMode: RoundingMode;// criterio elegido por el funcionario
}

export interface MinimosResult {
  TM_inclusivo: Date;
  TM_mostrado: Date;
  TMd_raw: number;         // valor fraccionado sin redondeo "final"
  TMd_aplicado: number;    // entero aplicado según criterio
  TMBI: Date;
  CET: Date;
  CETd_raw: number;
  CETd_aplicado: number;
  tramo_TMBI_dias: number; // días inclusivos S→TMBI_inclusivo
}

function fRegimen(reg: Regimen): number {
  return reg === '2/3' ? 2/3 : 1/2;
}

function applyRounding(x: number, mode: RoundingMode): number {
  switch (mode) {
    case 'oficial': return Math.ceil(x);
    case 'pro_reo': return Math.floor(x);
    case 'matematico': return Math.round(x);
    default: return Math.ceil(x);
  }
}

/**
 * Cálculo "modo sistema" (Residual):
 * TMd = ceil(B×f) − ceil(Amin×(1−f))  [oficial]
 * Aquí mostramos TMd_raw y aplicamos el entero según criterio elegido.
 */
export function calcularMinimos(params: MinimosParams): MinimosResult {
  const { inicio, diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode } = params;
  const f = fRegimen(regimen);
  const parteNoEnLibertad = (1 - f);

  // --- TM ---
  const TMd_base = (diasBrutos * f) - (abonoMinimos * parteNoEnLibertad);
  // Guardar fracción tal cual
  const TMd_raw = TMd_base;

  // Entero aplicado según criterio funcionario (oficial=ceil)
  const TMd_aplicado = applyRounding(TMd_base, roundingMode);

  // TM inclusivo
  const TM_inclusivo = addDaysUTC(inicio, TMd_aplicado - 1);

  // Vista Oficial: TM mostrado = inclusivo + 1 día
  const TM_mostrado = vistaOficial ? addDaysUTC(TM_inclusivo, 1) : TM_inclusivo;

  // --- TMBI --- (desde TM mostrado -12 meses, respeta fin de mes)
  const TMBI = addMonthsRespectingEOM(TM_mostrado, -12);

  // --- CET ---
  // Tramo inclusivo S→TMBI_inclusivo
  // OJO: TMBI ya es "mostrado". Para el tramo usamos su valor como fecha destino inclusiva.
  const tramo_TMBI_dias = diasInclusivosUTC(inicio, TMBI);
  const CETd_base = tramo_TMBI_dias * f;
  const CETd_raw = CETd_base;
  const CETd_aplicado = applyRounding(CETd_base, roundingMode); // oficial=ceil
  const CET = addDaysUTC(inicio, CETd_aplicado - 1); // sin ajuste visual

  return {
    TM_inclusivo,
    TM_mostrado,
    TMd_raw,
    TMd_aplicado,
    TMBI,
    CET,
    CETd_raw,
    CETd_aplicado,
    tramo_TMBI_dias
  };
}