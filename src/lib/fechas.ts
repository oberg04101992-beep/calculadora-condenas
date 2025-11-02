// src/lib/fechas.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

// Crea fecha UTC segura desde DD/MM/AAAA (utilidad opcional)
export function dDMY(s: string): Date {
  const [DD, MM, YYYY] = s.split('/').map(Number);
  return new Date(Date.UTC(YYYY, (MM - 1), DD));
}

// Suma días en UTC
export function addDaysUTC(base: Date, days: number): Date {
  const t = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + days
  );
  return new Date(t);
}

// Días inclusivos en UTC [inicio, fin], ambos cuentan
export function diasInclusivosUTC(inicio: Date, fin: Date): number {
  const ms = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate())
          - Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  return Math.floor(ms / 86400000) + 1;
}

// Añade meses respetando fin de mes (UTC)
export function addMonthsRespectingEOM(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const target = dayjs.utc(Date.UTC(y, m, d)).add(months, 'month');

  return new Date(Date.UTC(
    target.year(),
    target.month(),
    target.date()
  ));
}

export function fmt(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = date.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}