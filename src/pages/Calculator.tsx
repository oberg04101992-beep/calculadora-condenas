// src/pages/Calculator.tsx (demo de integración)
import React, { useMemo } from "react";
import HowItWasCalculated from "../components/HowItWasCalculated";
import type { CalculationStep } from "../types/calculation";
import { addYMDUTC, formatDDMMYYYYUTC } from "../utils/dates";

export default function Calculator() {
  const inicio = useMemo(() => new Date(Date.UTC(2012, 9, 13)), []); // 13/10/2012 UTC

  const steps: CalculationStep[] = useMemo(() => {
    const paso1Fin = addYMDUTC(inicio, 0, 0, 533 - 1); // 533 días inclusivos (ejemplo pedagógico)
    const paso2Inicio = new Date(paso1Fin.getTime());
    const paso2Fin = addYMDUTC(paso2Inicio, 0, 0, 400);
    return [
      {
        label: "Condena 1 — Microtráfico (2/3 de 800 = 533 días)",
        detail: `Inicio ${formatDDMMYYYYUTC(inicio)} → fin ${formatDDMMYYYYUTC(paso1Fin)}`,
        value: "533 días",
      },
      {
        label: "Condena 2 — Robo N/H (2/3 de 600 = 400 días)",
        detail: `Inicio ${formatDDMMYYYYUTC(paso2Inicio)} → fin ${formatDDMMYYYYUTC(paso2Fin)}`,
        value: "400 días",
      },
    ];
  }, [inicio]);

  const resumen = "Desglose pedagógico: totales por condena considerando días inclusivos y reglas 2/3 donde aplica.";

  return (
    <div className="space-y-4">
      {/* Aquí va tu UI de cálculo real */}
      <HowItWasCalculated steps={steps} resumen={resumen} />
    </div>
  );
}
