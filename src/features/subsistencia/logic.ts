// src/features/subsistencia/logic.ts
export interface ItemSubsistencia {
  dias?: number;
  etiqueta: string;
}

export interface ResultadoSubsistencia {
  totalDias: number;
  items: ItemSubsistencia[];
}

export function calcularSubsistencia(items?: ItemSubsistencia[] | null): ResultadoSubsistencia {
  const lista = Array.isArray(items) ? items : [];
  const total = lista.reduce((acc, it) => acc + (Number.isFinite(it.dias) ? (it.dias as number) : 0), 0);
  return { totalDias: total, items: lista };
}
