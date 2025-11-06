// src/types/calculation.ts
export type Regimen = "MITAD" | "DOS_TERCIOS";

export interface CalculationStep {
  label: string;
  detail?: string;
  value?: string;
}

export interface HowItProps {
  steps?: CalculationStep[];
  resumen?: string;
}
