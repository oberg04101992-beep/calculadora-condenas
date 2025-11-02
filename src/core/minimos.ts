// src/core/minimos.ts
import { addDaysUTC, addMonthsRespectingEOM, diasInclusivosUTC } from '../lib/fechas';

export type Regimen = '1/2' | '2/3';
export type RoundingMode = 'oficial' | 'pro_reo' | 'matematico';

export interface MinimosParams {
  inicio: Date;
  diasBrutos: number;
  abonoMinimos: number;     // "Abonos que afectan mínimos (global)"
  regimen: Regimen;         // 1/2 o 2/3
  vistaOficial: boolean;    // true = vista "Oficial (exclusiva)"
  roundingMode: RoundingMode;
}

export interface MinimosResult {
  TM_inclusivo: Date;
  TM_mostrado: Date;
  TMd_raw: number;
  TMd_aplicado: number;
  TMBI: Date;
  CET: Date;
  CETd_raw: number;
  CETd_aplicado: number;
  tramo_TMBI_dias: number;
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
 * MODO SISTEMA (compatible): "Residual"
 * TMd_base = (B×f) − (Amin×(1−f))   (guardamos la fracción y aplicamos redondeo elegido)
 * Vista Oficial: TM mostrado = TM inclusivo + 1 día.
 * CET: tramo inclusivo S→TMBI, sin ajuste visual.
 */
export function calcularMinimos(params: MinimosParams): MinimosResult {
  const { inicio, diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode } = params;
  const f = fRegimen(regimen);
  const parteNoEnLibertad = (1 - f);

  // --- TM ---
  const TMd_base = (diasBrutos * f) - (abonoMinimos * parteNoEnLibertad);
  const TMd_raw = TMd_base;
  const TMd_aplicado = applyRounding(TMd_base, roundingMode);
  const TM_inclusivo = addDaysUTC(inicio, TMd_aplicado - 1);
  const TM_mostrado = vistaOficial ? addDaysUTC(TM_inclusivo, 1) : TM_inclusivo;

  // --- TMBI ---
  const TMBI = addMonthsRespectingEOM(TM_mostrado, -12);

  // --- CET ---
  const tramo_TMBI_dias = diasInclusivosUTC(inicio, TMBI);
  const CETd_base = tramo_TMBI_dias * f;
  const CETd_raw = CETd_base;
  const CETd_aplicado = applyRounding(CETd_base, roundingMode);
  const CET = addDaysUTC(inicio, CETd_aplicado - 1);

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