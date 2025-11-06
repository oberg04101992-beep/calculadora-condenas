// src/utils/dates.ts
export type YMD = { y: number; m: number; d: number };

// Convierte DD/MM/AAAA a Date UTC (00:00:00Z)
export function parseDDMMYYYY(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
}

export function formatDDMMYYYYUTC(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Suma inclusiva de días: Inicio→Fin cuenta ambos extremos.
export function addDaysInclusiveUTC(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  result.setUTCDate(result.getUTCDate() + (days - 1));
  return result;
}

// Suma (años, meses) respetando fin de mes en UTC.
export function addYMDUTC(base: Date, years = 0, months = 0, days = 0): Date {
  const y = base.getUTCFullYear() + years;
  const m = base.getUTCMonth() + months;
  const d = base.getUTCDate();
  const tmp = new Date(Date.UTC(y, m + 1, 0)); // último día del mes destino
  const safeD = Math.min(d, tmp.getUTCDate());
  const dt = new Date(Date.UTC(y, m, safeD));
  if (days) dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}

export function minusMonthsUTC(base: Date, months = 0): Date {
  return addYMDUTC(base, 0, -months, 0);
}
