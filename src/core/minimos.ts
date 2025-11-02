export type Regimen = "1/2" | "2/3";
export type EncadenadoMode = "dia_siguiente" | "mismo_dia";
export type RoundingMode = "residual" | "truncado" | "matematico";

export type CausaCalculo = {
  anios: number;
  meses: number;
  dias: number;
  abonoCausa?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function fmtDMY(d?: Date | null): string {
  if (!d || Number.isNaN(d.getTime?.())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

export function parseDMYtoUTC(raw?: string | null): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yy = Number(match[3]);
  const date = new Date(Date.UTC(yy, mm - 1, dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDaysUTC(base: Date, days: number): Date {
  const ts = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate()
  );
  return new Date(ts + days * DAY_MS);
}

export function addYearsMonthsUTC(
  base: Date,
  years: number,
  months: number
): Date {
  const y = base.getUTCFullYear() + years;
  const m0 = base.getUTCMonth() + months;
  const y2 = y + Math.floor(m0 / 12);
  const m2 = ((m0 % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  const day = Math.min(base.getUTCDate(), lastDay);
  return new Date(Date.UTC(y2, m2, day));
}

export function diffDaysInclusiveUTC(a: Date, b: Date): number {
  const A = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const B = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((B - A) / DAY_MS) + 1;
}

export function finDeCausa(
  inicio: Date,
  anios: number,
  meses: number,
  dias: number
): Date {
  const base = addYearsMonthsUTC(inicio, anios || 0, meses || 0);
  return dias && dias > 0 ? addDaysUTC(base, dias - 1) : base;
}

type EncadenadoResultado = {
  finBruto: Date;
  finConAbonos: Date;
  totalBrutos: number;
  totalConAbonos: number;
};

export function encadenarExpediente(
  causas: CausaCalculo[],
  inicioDMY: string,
  encadenado: EncadenadoMode
): EncadenadoResultado | null {
  const inicio = parseDMYtoUTC(inicioDMY);
  if (!inicio) return null;
  if (!Array.isArray(causas) || causas.length === 0)
    return {
      finBruto: inicio,
      finConAbonos: inicio,
      totalBrutos: 0,
      totalConAbonos: 0,
    };

  let startBruto = inicio;
  let startAbono = inicio;
  let finBruto = inicio;
  let finConAbonos = inicio;
  let totalBrutos = 0;
  let totalConAbonos = 0;

  for (const causa of causas) {
    const endBruto = finDeCausa(
      startBruto,
      Math.max(0, causa.anios || 0),
      Math.max(0, causa.meses || 0),
      Math.max(0, causa.dias || 0)
    );
    const durBruto = diffDaysInclusiveUTC(startBruto, endBruto);

    const capacidad = durBruto;
    const ab = Math.max(0, Math.min(capacidad, causa.abonoCausa || 0));
    const durConAbonos = Math.max(0, durBruto - ab);
    const endConAbonos =
      durConAbonos > 0
        ? addDaysUTC(startAbono, durConAbonos - 1)
        : addDaysUTC(startAbono, -1);

    totalBrutos += durBruto;
    totalConAbonos += durConAbonos;
    finBruto = endBruto;
    finConAbonos = endConAbonos;

    if (encadenado === "dia_siguiente") {
      startBruto = addDaysUTC(endBruto, 1);
      startAbono = addDaysUTC(endConAbonos, 1);
    } else {
      startBruto = endBruto;
      startAbono = endConAbonos;
    }
  }

  return { finBruto, finConAbonos, totalBrutos, totalConAbonos };
}

export function roundWithMode(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value)) return 0;
  if (mode === "truncado") return Math.floor(value);
  if (mode === "matematico") return Math.round(value);
  return Math.ceil(value);
}

export interface CalculoMinimosInput {
  inicio: string;
  causas: CausaCalculo[];
  encadenado: EncadenadoMode;
  regimen: Regimen;
  vista: "oficial" | "doctrinal";
  abonoGlobal: number;
  abonoMinimosGlobal: boolean;
  roundingMode: RoundingMode;
}

export interface CalculoMinimosOutput {
  valido: boolean;
  totalDiasBrutos: number;
  totalTrasAbonosCausa: number;
  totalAbonosCausa: number;
  abonoGlobalIngresado: number;
  abonoGlobalAplicado: number;
  baseEfectiva: number;
  terminoOriginal: string;
  tmFraccionDias: number;
  tmDiasAplicados: number;
  tmFechaInclusiva: string;
  tmFechaVista: string;
  tmbi: string;
  diasInicioATmbi: number;
  cetFraccionDias: number;
  cetDiasAplicados: number;
  cetFechaInclusiva: string;
  cetFechaVista: string;
  ratioTM: { numerador: number; denominador: number; etiqueta: string };
}

const EMPTY_RESULT: CalculoMinimosOutput = {
  valido: false,
  totalDiasBrutos: 0,
  totalTrasAbonosCausa: 0,
  totalAbonosCausa: 0,
  abonoGlobalIngresado: 0,
  abonoGlobalAplicado: 0,
  baseEfectiva: 0,
  terminoOriginal: "",
  tmFraccionDias: 0,
  tmDiasAplicados: 0,
  tmFechaInclusiva: "",
  tmFechaVista: "",
  tmbi: "",
  diasInicioATmbi: 0,
  cetFraccionDias: 0,
  cetDiasAplicados: 0,
  cetFechaInclusiva: "",
  cetFechaVista: "",
  ratioTM: { numerador: 2, denominador: 3, etiqueta: "2/3" },
};

export function calcularMinimos(
  input: CalculoMinimosInput
): CalculoMinimosOutput {
  const inicioDate = parseDMYtoUTC(input.inicio);
  if (!inicioDate) {
    return { ...EMPTY_RESULT, abonoGlobalIngresado: Math.max(0, input.abonoGlobal) };
  }

  const causasNormalizadas = Array.isArray(input.causas)
    ? input.causas.map((c) => ({
        anios: Math.max(0, Number(c.anios) || 0),
        meses: Math.max(0, Number(c.meses) || 0),
        dias: Math.max(0, Number(c.dias) || 0),
        abonoCausa: Math.max(0, Number(c.abonoCausa) || 0),
      }))
    : [];

  const totalAbonosCausa = causasNormalizadas.reduce(
    (sum, c) => sum + Math.max(0, c.abonoCausa || 0),
    0
  );

  const chain = encadenarExpediente(
    causasNormalizadas,
    input.inicio,
    input.encadenado
  );

  if (!chain) {
    return {
      ...EMPTY_RESULT,
      abonoGlobalIngresado: Math.max(0, input.abonoGlobal),
      totalAbonosCausa,
    };
  }

  const abonoGlobalIngresado = Math.max(0, input.abonoGlobal || 0);
  const abonoGlobalAplicado = input.abonoMinimosGlobal
    ? abonoGlobalIngresado
    : 0;
  const baseEfectiva = Math.max(
    0,
    (chain.totalConAbonos || 0) - abonoGlobalAplicado
  );

  const ratioTM = input.regimen === "1/2"
    ? { numerador: 1, denominador: 2, etiqueta: "1/2" }
    : { numerador: 2, denominador: 3, etiqueta: "2/3" };

  const tmFraccionDias = baseEfectiva * (ratioTM.numerador / ratioTM.denominador);
  const tmDiasAplicados =
    baseEfectiva > 0
      ? Math.max(0, roundWithMode(tmFraccionDias, input.roundingMode))
      : 0;

  const terminoOriginal =
    baseEfectiva > 0
      ? fmtDMY(addDaysUTC(inicioDate, baseEfectiva - 1))
      : "";

  const tmFechaInclusivaDate =
    tmDiasAplicados > 0
      ? addDaysUTC(inicioDate, Math.max(0, tmDiasAplicados - 1))
      : null;

  const tmFechaVistaDate = (() => {
    if (!tmFechaInclusivaDate) return null;
    if (input.vista === "oficial") {
      return addDaysUTC(tmFechaInclusivaDate, 1);
    }
    return tmFechaInclusivaDate;
  })();

  const tmFechaInclusiva = fmtDMY(tmFechaInclusivaDate);
  const tmFechaVista = fmtDMY(tmFechaVistaDate);

  const tmbiDate = tmFechaVistaDate
    ? addYearsMonthsUTC(tmFechaVistaDate, -1, 0)
    : null;
  const tmbi = fmtDMY(tmbiDate);

  const diasInicioATmbi = tmbiDate
    ? Math.max(0, diffDaysInclusiveUTC(inicioDate, tmbiDate))
    : 0;

  const cetFraccionDias = diasInicioATmbi * (2 / 3);
  const cetDiasAplicados =
    diasInicioATmbi > 0
      ? Math.max(0, roundWithMode(cetFraccionDias, input.roundingMode))
      : 0;

  const cetFechaInclusivaDate =
    cetDiasAplicados > 0
      ? addDaysUTC(inicioDate, Math.max(0, cetDiasAplicados - 1))
      : null;

  const cetFechaVistaDate = (() => {
    if (!cetFechaInclusivaDate) return null;
    if (input.vista === "oficial") {
      return addDaysUTC(cetFechaInclusivaDate, cetDiasAplicados > 0 ? -1 : 0);
    }
    return cetFechaInclusivaDate;
  })();

  const cetFechaInclusiva = fmtDMY(cetFechaInclusivaDate);
  const cetFechaVista = fmtDMY(cetFechaVistaDate);

  const valido = baseEfectiva > 0 && !!tmFechaVistaDate;

  return {
    valido,
    totalDiasBrutos: chain.totalBrutos,
    totalTrasAbonosCausa: chain.totalConAbonos,
    totalAbonosCausa,
    abonoGlobalIngresado,
    abonoGlobalAplicado,
    baseEfectiva,
    terminoOriginal,
    tmFraccionDias,
    tmDiasAplicados,
    tmFechaInclusiva,
    tmFechaVista,
    tmbi,
    diasInicioATmbi,
    cetFraccionDias,
    cetDiasAplicados,
    cetFechaInclusiva,
    cetFechaVista,
    ratioTM,
  };
}
