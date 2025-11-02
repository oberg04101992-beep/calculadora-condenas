// src/lib/motorFechasGendarmeria.ts
export type Causa = {
  years?: number;
  months?: number;
  days?: number;
  abonos?: number; // días abonados a ESTA causa (solo afecta término)
};

export type Minimos = {
  totalDiasBrutos: number;  // suma calendario sin abonos
  f13: Date;   // 1/3 global
  f12: Date;   // 1/2 global
  f23: Date;   // 2/3 global
  tmbi12: Date; // 12 meses antes de 1/2
  tmbi23: Date; // 12 meses antes de 2/3
};

export const CONFIG = {
  encadenadoMismoDia: true,         // oficial: la siguiente causa parte el MISMO día del fin anterior
  redondeoMinimos: "ceil" as "ceil" | "floor" | "round",
  minimosUsanAbonos: false,         // oficial: abonos NO mueven 1/3-1/2-2/3
};

// --- Fechas (UTC para evitar desfaces) ---
function toUTCDate(y: number, m0: number, d: number) {
  return new Date(Date.UTC(y, m0, d));
}
function ymdUTC(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
export function diffDays(a: Date, b: Date) {
  return Math.round((ymdUTC(b) - ymdUTC(a)) / 86400000);
}
export function fmtDMY(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

// Suma real de A/M/D con “fin de mes”
export function addYMD(start: Date, y = 0, m = 0, d = 0): Date {
  const Y = start.getUTCFullYear() + y;
  const M0 = start.getUTCMonth() + m;
  const y2 = Y + Math.floor(M0 / 12);
  const m2 = ((M0 % 12) + 12) % 12;
  const last = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), last);
  const base = toUTCDate(y2, m2, day);
  base.setUTCDate(base.getUTCDate() + d);
  return base;
}

// Duración bruta de una causa medida desde un cursor (sin abonos) — inclusivo
export function durDiasBrutos(cursor: Date, c: Causa) {
  const end = addYMD(cursor, c.years ?? 0, c.months ?? 0, c.days ?? 0);
  return diffDays(cursor, end) + 1;
}

// Encadenado + término global (aplicando abonos SOLO al término)
export function terminoEncadenado(inicio: Date, causas: Causa[]): Date {
  let cursor = toUTCDate(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  for (const c of causas) {
    let finBruto = addYMD(cursor, c.years ?? 0, c.months ?? 0, c.days ?? 0);
    const abn = Math.max(0, c.abonos ?? 0);
    if (abn) finBruto = addYMD(finBruto, 0, 0, -abn);
    cursor = CONFIG.encadenadoMismoDia ? finBruto : addYMD(finBruto, 0, 0, 1);
  }
  return cursor;
}

function roundFr(n: number) {
  return CONFIG.redondeoMinimos === "ceil" ? Math.ceil(n)
    : CONFIG.redondeoMinimos === "floor" ? Math.floor(n)
    : Math.round(n);
}

// Mínimos globales (por defecto: sobre BRUTOS, sin abonos)
export function minimosGlobales(inicio: Date, causas: Causa[]): Minimos {
  let totalBrutos = 0;
  let cursor = toUTCDate(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  for (const c of causas) {
    const bruto = durDiasBrutos(cursor, c);
    totalBrutos += bruto;
    cursor = addYMD(cursor, c.years ?? 0, c.months ?? 0, c.days ?? 0);
  }

  // Si ALGUNA vez te piden que abonos afecten mínimos, cambia el flag arriba a true.
  if (CONFIG.minimosUsanAbonos) {
    let totalAbonos = 0;
    for (const c of causas) totalAbonos += Math.max(0, c.abonos ?? 0);
    totalBrutos = Math.max(0, totalBrutos - totalAbonos);
  }

  const d13 = roundFr(totalBrutos / 3);
  const d12 = roundFr(totalBrutos / 2);
  const d23 = roundFr((totalBrutos * 2) / 3);

  const f13 = addYMD(inicio, 0, 0, Math.max(1, d13) - 1);
  const f12 = addYMD(inicio, 0, 0, Math.max(1, d12) - 1);
  const f23 = addYMD(inicio, 0, 0, Math.max(1, d23) - 1);

  const tmbi12 = addYMD(f12, -1, 0, 0);
  const tmbi23 = addYMD(f23, -1, 0, 0);

  return { totalDiasBrutos: totalBrutos, f13, f12, f23, tmbi12, tmbi23 };
}

// Cálculo completo de expediente
export function calcularExpediente(
  inicio: Date,
  causas: Causa[],
  reduccionTotalEnDias?: number,
  baseTMBI: "1/2" | "2/3" = "2/3"
) {
  const terminoOriginal = terminoEncadenado(inicio, causas);
  const min = minimosGlobales(inicio, causas);
  const base = baseTMBI === "1/2" ? min.f12 : min.f23;
  const tmbi = baseTMBI === "1/2" ? min.tmbi12 : min.tmbi23;
  const terminoConReduccion = typeof reduccionTotalEnDias === "number"
    ? addYMD(terminoOriginal, 0, 0, -Math.max(0, reduccionTotalEnDias))
    : undefined;
  return { terminoOriginal, terminoConReduccion, minimos: { ...min, base, tmbi } };
}

// Helper para UI
export function toSalida(exp: ReturnType<typeof calcularExpediente>) {
  const { terminoOriginal, terminoConReduccion, minimos } = exp;
  return {
    terminoOriginal: fmtDMY(terminoOriginal),
    terminoConReduccion: terminoConReduccion ? fmtDMY(terminoConReduccion) : "-",
    minimo13: fmtDMY(minimos.f13),
    minimo12: fmtDMY(minimos.f12),
    minimo23: fmtDMY(minimos.f23),
    tmbi: fmtDMY(minimos.tmbi),
    totalDiasBrutos: minimos.totalDiasBrutos,
  };
}

// Test rápido (por si quieres validar)
export function _test_CP_PA_001() {
  const inicio = new Date(Date.UTC(2020, 3, 16)); // 16/04/2020
  const causas: Causa[] = [{ years: 6 }, { days: 600 }]; // sin “+1 día”
  const exp = calcularExpediente(inicio, causas, 0, "2/3");
  const ui = toSalida(exp);
  const EXPECT = {
    terminoOriginal: "07/12/2027",
    minimo23: "21/05/2025",
    tmbi: "21/05/2024",
    minimo13: "02/11/2022",
  };
  return { ui, EXPECT };
}

describe("legacy expediente helpers", () => {
  it("mantiene el cálculo de ejemplo", () => {
    const { ui, EXPECT } = _test_CP_PA_001();
    expect(ui.terminoOriginal).toBe(EXPECT.terminoOriginal);
    expect(ui.minimo23).toBe(EXPECT.minimo23);
    expect(ui.tmbi).toBe(EXPECT.tmbi);
    expect(ui.minimo13).toBe(EXPECT.minimo13);
  });
});
