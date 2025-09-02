// src/lib/computosOficial.ts
// Motor oficial: UTC puro, fin de mes correcto, encadenado con +1 SOLO entre causas, sin +1 al final.
// Mínimos (TM/TMBI): base = total_bruto_inclusivo − abonos_totales_expediente, regla exclusiva (oficial).
// TM CET: 2/3 del tramo [inicio → TMBI], inclusivo, ajuste −1 día.

export type TmTipo = "auto" | "1/2" | "2/3";
export type EncadenadoMode = "dia_siguiente" | "mismo_dia";
export type MinRule = "exclusiva" | "inclusiva";
export type DistMode = "gravosas" | "proporcional";

export type Causa = {
  years?: number;
  months?: number;
  days?: number;
  abonos?: number;               // abonos aplicados a ESTA causa (termino)
  regimen?: "1/2" | "2/3";       // para “auto por causas”
};

// ===== UTC & fechas =====
const ONE_DAY = 86_400_000;

export function toUTC(y: number, m0: number, d: number) {
  return new Date(Date.UTC(y, m0, d));
}
const ymd = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function addDaysUTC(d: Date, n: number) {
  return new Date(ymd(d) + n * ONE_DAY);
}
export function diffDays(a: Date, b: Date) {
  return Math.round((ymd(b) - ymd(a)) / ONE_DAY);
}
export function diffIncl(a: Date, b: Date) {
  return diffDays(a, b) + 1;
}
export function fmtDMY(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

// Fin de mes correcto para A/M/D en bloque
export function addYMD(base: Date, y = 0, m = 0, d = 0): Date {
  const Y = base.getUTCFullYear() + y;
  const M = base.getUTCMonth() + m;
  const y2 = Y + Math.floor(M / 12);
  const m2 = ((M % 12) + 12) % 12;
  const last = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  const day = Math.min(base.getUTCDate(), last);
  const tmp = toUTC(y2, m2, day);
  return addDaysUTC(tmp, d);
}

// Entrada UI: DD/MM/AAAA → Date UTC
export function parseInputDMYToUTC(s: string): Date {
  const [dd, mm, yy] = s.split("/").map((t) => Number(t.trim()));
  if (!yy || !mm || !dd) throw new Error("Fecha inválida");
  return toUTC(yy, mm - 1, dd);
}

// ===== Núcleo =====

// Duración bruta INCLUSIVA de una causa medida desde 'cursor' (sin abonos)
// Regla clave (para corregir el “+1”):
// - Si la causa es SOLO días (y=m=0), el fin correcto es cursor + (days-1)
// - Si hay años o meses, primero sumo A/M (finCal) y LUEGO agrego 'days' completos (fin = finCal + days)
export function durBrutaCausa(cursor: Date, c: Causa) {
  const y = c.years ?? 0, m = c.months ?? 0, d = c.days ?? 0;
  const finCal = addYMD(cursor, y, m, 0);
  let fin: Date;
  if (y === 0 && m === 0) {
    const dd = Math.max(0, d - 1);
    fin = addDaysUTC(cursor, dd);
  } else {
    fin = addDaysUTC(finCal, d);
  }
  return { fin, diasIncl: diffIncl(cursor, fin) };
}

// Encadenado con abonos por causa (clamp por capacidad). +1 SOLO entre causas.
export function terminoEncadenado(inicio: Date, causas: Causa[], encadenado: EncadenadoMode) {
  let cursor = toUTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  let ultimoFin = cursor;
  for (let i = 0; i < causas.length; i++) {
    const { fin, diasIncl } = durBrutaCausa(cursor, causas[i]);
    const cap = diasIncl;
    const ab = Math.max(0, Math.min(cap, causas[i].abonos ?? 0));
    const finAjustado = addDaysUTC(fin, -ab);
    ultimoFin = finAjustado;
    const noUltima = i < causas.length - 1;
    cursor = (encadenado === "dia_siguiente" && noUltima) ? addDaysUTC(finAjustado, 1) : finAjustado;
  }
  return ultimoFin;
}

// Total bruto INCLUSIVO (sin abonos), respetando encadenado entre causas
export function totalBrutoIncl(inicio: Date, causas: Causa[], encadenado: EncadenadoMode) {
  let cursor = toUTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  let suma = 0;
  for (let i = 0; i < causas.length; i++) {
    const { fin, diasIncl } = durBrutaCausa(cursor, causas[i]);
    suma += diasIncl;
    const noUltima = i < causas.length - 1;
    cursor = (encadenado === "dia_siguiente" && noUltima) ? addDaysUTC(fin, 1) : fin;
  }
  return suma;
}

// Total INCLUSIVO con abonos (para mostrar “días totales con abonos”)
export function totalConAbonosIncl(inicio: Date, causas: Causa[], encadenado: EncadenadoMode) {
  let cursor = toUTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  let suma = 0;
  for (let i = 0; i < causas.length; i++) {
    const { fin, diasIncl } = durBrutaCausa(cursor, causas[i]);
    const cap = diasIncl;
    const ab = Math.max(0, Math.min(cap, causas[i].abonos ?? 0));
    const finAjustado = addDaysUTC(fin, -ab);
    const diasAjustados = diffIncl(cursor, finAjustado);
    suma += diasAjustados;
    const noUltima = i < causas.length - 1;
    cursor = (encadenado === "dia_siguiente" && noUltima) ? addDaysUTC(finAjustado, 1) : finAjustado;
  }
  return suma;
}

// Mínimos
function pasosMinimos(baseDiasIncl: number, tipo: "1/2" | "2/3") {
  const frac = tipo === "2/3" ? 2 / 3 : 1 / 2;
  return Math.ceil(baseDiasIncl * frac);
}
function fechaMinimo(inicio: Date, pasos: number, rule: MinRule) {
  const delta = rule === "exclusiva" ? Math.max(0, pasos - 1) : pasos;
  return addDaysUTC(inicio, delta);
}
function tmbiDesdeTM(tm: Date) {
  return addYMD(tm, -1, 0, 0); // −12 meses con fin de mes
}

// Ordenar gravosas (duración bruta desc; a igual, 2/3 primero)
export function ordenarGravosas(causas: Causa[]) {
  const base = toUTC(2000, 0, 1);
  const weighted = causas.map((c, idx) => {
    const { diasIncl } = durBrutaCausa(base, c);
    const peso = diasIncl * 1000 + (c.regimen === "2/3" ? 1 : 0);
    return { c, idx, peso };
  });
  weighted.sort((a, b) => b.peso - a.peso || a.idx - b.idx);
  return weighted.map((x) => ({ ...x.c }));
}

// Régimen global automático: si alguna es 2/3 ⇒ global 2/3
export function regimenGlobal(causas: Causa[]): "1/2" | "2/3" {
  return causas.some((c) => c.regimen === "2/3") ? "2/3" : "1/2";
}

// Distribución de abonos totales entre causas
export function distribuirAbonosTotales(
  inicio: Date,
  causas: Causa[],
  encadenado: EncadenadoMode,
  abonoTotal: number,
  mode: DistMode = "gravosas",
  replace = true
): { causasConAbonos: Causa[]; asignacion: number[] } {
  const n = causas.length;
  // Capacidades por causa (sin abonos), respetando encadenado para el cursor
  let cursor = toUTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const diasCap: number[] = [];
  for (let i = 0; i < n; i++) {
    const { fin, diasIncl } = durBrutaCausa(cursor, causas[i]);
    diasCap.push(diasIncl);
    const noUltima = i < n - 1;
    cursor = (encadenado === "dia_siguiente" && noUltima) ? addDaysUTC(fin, 1) : fin;
  }

  const out = causas.map((c) => ({ ...c }));
  const toAssign = Math.max(0, Math.floor(abonoTotal));

  if (toAssign === 0) return { causasConAbonos: out, asignacion: Array(n).fill(0) };

  const asigna = Array(n).fill(0);

  if (mode === "proporcional") {
    const totalCap = diasCap.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < n; i++) {
      asigna[i] = Math.min(diasCap[i], Math.floor((toAssign * diasCap[i]) / totalCap));
    }
    let rem = toAssign - asigna.reduce((a, b) => a + b, 0);
    if (rem > 0) {
      const orden = Array.from({ length: n }, (_, i) => i)
        .sort((i, j) => (diasCap[j] - diasCap[i]) || (i - j));
      for (let k = 0; k < orden.length && rem > 0; k++) {
        const i = orden[k];
        const libre = diasCap[i] - asigna[i];
        if (libre > 0) {
          const take = Math.min(libre, rem);
          asigna[i] += take;
          rem -= take;
        }
      }
    }
  } else {
    // gravosas: largo → corto
    const orden = Array.from({ length: n }, (_, i) => i)
      .sort((i, j) => (diasCap[j] - diasCap[i]) || (i - j));
    let rem = toAssign;
    for (let k = 0; k < orden.length && rem > 0; k++) {
      const i = orden[k];
      const libre = diasCap[i];
      const take = Math.min(libre, rem);
      asigna[i] = take;
      rem -= take;
    }
  }

  for (let i = 0; i < n; i++) {
    const base = replace ? 0 : (out[i].abonos ?? 0);
    out[i].abonos = base + asigna[i];
  }

  return { causasConAbonos: out, asignacion: asigna };
}

// TM CET = 2/3 del tramo [inicio → TMBI], inclusivo, ajuste −1 día
export function tmCETDesdeTMBI(inicio: Date, tmbiOficial: Date | null): Date | null {
  if (!tmbiOficial) return null;
  if (ymd(tmbiOficial) <= ymd(inicio)) return inicio;
  const base = diffIncl(inicio, tmbiOficial);
  const pasos = Math.ceil(base * (2 / 3));
  return addDaysUTC(inicio, Math.max(0, pasos - 1));
}

// ===== API principal =====
export function calcularYFormatear(
  input: {
    inicio: Date;
    causas: Causa[];
    tmTipo: TmTipo;                       // "auto" usa regimenGlobal
    abonosTotalesExpediente: number;      // afecta TM/TMBI
    aplicarAbonoTotalAlTermino?: boolean; // si true, distribuye y afecta TÉRMINO
    distMode?: DistMode;                  // "gravosas" | "proporcional"
    reemplazarAbonosExistentes?: boolean; // por defecto true
  },
  opts: {
    encadenado: EncadenadoMode;
    // oficial: mínimos exclusivos (fijo)
  }
) {
  const causasBase = [...input.causas];
  const tmTipoReal: "1/2" | "2/3" =
    input.tmTipo === "auto" ? regimenGlobal(causasBase) : input.tmTipo;

  // 1) Mínimos oficiales (base = total_bruto_inclusivo − abonos_totales)
  const totalBruto = totalBrutoIncl(input.inicio, causasBase, opts.encadenado);
  const baseMin = Math.max(0, totalBruto - Math.max(0, Math.floor(input.abonosTotalesExpediente)));
  const pasos = pasosMinimos(baseMin, tmTipoReal);
  const tmDate = fechaMinimo(input.inicio, pasos, "exclusiva"); // OFICIAL
  const tmbiDate = tmbiDesdeTM(tmDate);

  // 2) Término (posible distribución si se pide)
  let causasTermino = causasBase;
  let asignacion: number[] = new Array(causasBase.length).fill(0);

  if (input.aplicarAbonoTotalAlTermino) {
    const { causasConAbonos, asignacion: asig } = distribuirAbonosTotales(
      input.inicio,
      causasBase,
      opts.encadenado,
      Math.max(0, Math.floor(input.abonosTotalesExpediente)),
      input.distMode ?? "gravosas",
      input.reemplazarAbonosExistentes ?? true
    );
    causasTermino = causasConAbonos;
    asignacion = asig;
  }

  const termino = terminoEncadenado(input.inicio, causasTermino, opts.encadenado);
  const totalConAbonos = totalConAbonosIncl(input.inicio, causasTermino, opts.encadenado);
  const abonosSumaCausas = causasTermino.reduce((a, b) => a + Math.max(0, b.abonos ?? 0), 0);

  return {
    // Fechas
    terminoOriginal: fmtDMY(termino),
    tm: fmtDMY(tmDate),
    tmbi: fmtDMY(tmbiDate),
    // Números
    tmTipo: tmTipoReal,
    totalBruto,
    totalDiasConAbonos: totalConAbonos,
    abonosSumaCausas,
    abonosExpediente: Math.max(0, Math.floor(input.abonosTotalesExpediente)),
    baseMinIncl: baseMin,
    // crudo para cálculos derivados en el componente
    _raw: {
      tm: tmDate,
      tmbi: tmbiDate,
      termino,
      asignacion,
    },
  };
}