export type ModoDistribucion = "gravosas" | "proporcional";

export type CausaBase = {
  id: string;
  nombre?: string;
  duracionBrutaDias: number;
  abonoCausa: number;
};

export type PropuestaItem = {
  id: string;
  propuesto: number;
  capacidad: number;
  capped: boolean;
};

export type PropuestaDistribucion = {
  items: PropuestaItem[];
  totalSolicitado: number;
  totalAsignado: number;
  remanente: number;
  modo: ModoDistribucion;
};

function ordenarGravosas<T extends { duracionBrutaDias: number; id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    b.duracionBrutaDias !== a.duracionBrutaDias ? b.duracionBrutaDias - a.duracionBrutaDias : a.id.localeCompare(b.id)
  );
}

export function repartirAbonos(causas: CausaBase[], N: number, modo: ModoDistribucion): PropuestaDistribucion {
  const Ntarget = Math.max(0, Math.floor(N || 0));
  if (Ntarget === 0 || causas.length === 0) {
    return {
      items: causas.map(c => ({
        id: c.id,
        propuesto: 0,
        capacidad: Math.max(0, c.duracionBrutaDias - c.abonoCausa),
        capped: false,
      })),
      totalSolicitado: Ntarget,
      totalAsignado: 0,
      remanente: Ntarget,
      modo,
    };
  }

  const base = causas.map(c => ({
    ...c,
    capacidad: Math.max(0, c.duracionBrutaDias - c.abonoCausa),
  }));

  let propuesta: PropuestaItem[] = [];
  let asignado = 0;

  if (modo === "gravosas") {
    let restante = Ntarget;
    for (const c of ordenarGravosas(base)) {
      if (restante <= 0) break;
      const asignar = Math.min(restante, c.capacidad);
      propuesta.push({
        id: c.id,
        propuesto: asignar,
        capacidad: c.capacidad,
        capped: asignar === c.capacidad && c.capacidad > 0,
      });
      restante -= asignar;
      asignado += asignar;
    }
  } else {
    const totalDur = base.reduce((s, c) => s + c.duracionBrutaDias, 0) || 1;
    propuesta = base.map(c => {
      const cuota = Math.round((Ntarget * c.duracionBrutaDias) / totalDur);
      const asignar = Math.min(c.capacidad, Math.max(0, cuota));
      asignado += asignar;
      return { id: c.id, propuesto: asignar, capacidad: c.capacidad, capped: asignar === c.capacidad && c.capacidad > 0 };
    });
  }

  let remanente = Ntarget - asignado;
  if (remanente > 0) {
    for (const c of ordenarGravosas(base)) {
      if (remanente <= 0) break;
      const p = propuesta.find(p => p.id === c.id)!;
      const libre = Math.max(0, c.capacidad - p.propuesto);
      if (libre > 0) {
        const asignar = Math.min(libre, remanente);
        p.propuesto += asignar;
        p.capped = p.capped || asignar === libre;
        remanente -= asignar;
        asignado += asignar;
      }
    }
  }

  return { items: propuesta, totalSolicitado: Ntarget, totalAsignado: asignado, remanente, modo };
}