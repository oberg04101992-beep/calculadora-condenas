// src/components/HowItWasCalculated.tsx
import React from "react";
import CalculationAccordion from "./CalculationAccordion";
import type { CalculationStep, HowItProps } from "../types/calculation";

function isNonEmptyArray<T>(x: unknown): x is T[] {
  return Array.isArray(x) && x.length > 0;
}

export default function HowItWasCalculated({ steps, resumen }: HowItProps) {
  const safeSteps: CalculationStep[] = Array.isArray(steps) ? steps : [];

  // Opción A: si no hay pasos, no renderizamos nada
  if (!isNonEmptyArray<CalculationStep>(safeSteps)) {
    return null;
  }

  return (
    <CalculationAccordion title="Cómo se calculó este cómputo" defaultOpen={false}>
      {resumen && (
        <p className="mb-3 text-sm opacity-90" data-testid="howit-summary">{resumen}</p>
      )}

      <ol className="list-decimal pl-5 space-y-1" data-testid="howit-list">
        {safeSteps.map((s, idx) => (
          <li key={idx} className="leading-snug">
            <div className="font-medium">{s.label}</div>
            {s.detail && <div className="text-sm opacity-90">{s.detail}</div>}
            {s.value && <div className="text-sm">Resultado: <strong>{s.value}</strong></div>}
          </li>
        ))}
      </ol>
    </CalculationAccordion>
  );
}
