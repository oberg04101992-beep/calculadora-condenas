import { calcularSubsistencia } from "../features/subsistencia/logic";

describe("calcularSubsistencia", () => {
  it("tolera undefined y null", () => {
    expect(calcularSubsistencia(undefined).totalDias).toBe(0);
    expect(calcularSubsistencia(null as any).totalDias).toBe(0);
  });

  it("suma sólo números válidos", () => {
    const r = calcularSubsistencia([
      { etiqueta: "a", dias: 10 },
      { etiqueta: "b", dias: undefined },
      { etiqueta: "c", dias: NaN as any },
    ]);
    expect(r.totalDias).toBe(10);
  });
});
