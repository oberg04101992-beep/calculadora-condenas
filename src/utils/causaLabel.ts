// src/utils/causaLabel.ts
export type CausaLike = { nombre?: string | null };

export function causaLabel(causa: CausaLike, index: number): string {
  const n = (index ?? 0) + 1;
  const base = `Causa ${n}`;
  const clean = (causa?.nombre || "").trim();
  return clean ? `${base} — ${clean}` : base;
}