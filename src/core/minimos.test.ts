import { calcularMinimos, CalculoMinimosInput } from "./minimos";

describe("calcularMinimos", () => {
  const baseInput: Omit<CalculoMinimosInput, "abonoGlobal" | "abonoMinimosGlobal"> = {
    inicio: "01/01/2020",
    causas: [
      { anios: 2, meses: 0, dias: 0 },
    ],
    encadenado: "dia_siguiente",
    regimen: "2/3",
    vista: "oficial",
    roundingMode: "residual",
  };

  it("calcula regimen 2/3 sin abonos respetando fechas clave", () => {
    const resultado = calcularMinimos({
      ...baseInput,
      abonoGlobal: 0,
      abonoMinimosGlobal: false,
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.totalDiasBrutos).toBe(732);
    expect(resultado.totalTrasAbonosCausa).toBe(732);
    expect(resultado.totalAbonosCausa).toBe(0);
    expect(resultado.abonoGlobalIngresado).toBe(0);
    expect(resultado.abonoGlobalAplicado).toBe(0);
    expect(resultado.baseEfectiva).toBe(732);
    expect(resultado.terminoOriginal).toBe("01/01/2022");

    expect(resultado.tmFraccionDias).toBe(488);
    expect(resultado.tmDiasAplicados).toBe(488);
    expect(resultado.tmFechaInclusiva).toBe("02/05/2021");
    expect(resultado.tmFechaVista).toBe("03/05/2021");

    expect(resultado.tmbi).toBe("03/05/2020");
    expect(resultado.diasInicioATmbi).toBe(124);

    expect(resultado.cetFraccionDias).toBeCloseTo(82.6666666667);
    expect(resultado.cetDiasAplicados).toBe(83);
    expect(resultado.cetFechaInclusiva).toBe("23/03/2020");
    expect(resultado.cetFechaVista).toBe("22/03/2020");

    expect(resultado.ratioTM).toEqual({
      numerador: 2,
      denominador: 3,
      etiqueta: "2/3",
    });
  });

  it("aplica abonos globales en regimen 2/3 cuando afectan mínimos", () => {
    const resultado = calcularMinimos({
      ...baseInput,
      abonoGlobal: 100,
      abonoMinimosGlobal: true,
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.baseEfectiva).toBe(632);
    expect(resultado.abonoGlobalIngresado).toBe(100);
    expect(resultado.abonoGlobalAplicado).toBe(100);
    expect(resultado.terminoOriginal).toBe("23/09/2021");

    expect(resultado.tmFraccionDias).toBeCloseTo(421.3333333333);
    expect(resultado.tmDiasAplicados).toBe(422);
    expect(resultado.tmFechaInclusiva).toBe("25/02/2021");
    expect(resultado.tmFechaVista).toBe("26/02/2021");

    expect(resultado.tmbi).toBe("26/02/2020");
    expect(resultado.diasInicioATmbi).toBe(57);

    expect(resultado.cetFraccionDias).toBeCloseTo(38);
    expect(resultado.cetDiasAplicados).toBe(38);
    expect(resultado.cetFechaInclusiva).toBe("07/02/2020");
    expect(resultado.cetFechaVista).toBe("06/02/2020");
  });

  it("mantiene el término original con abonos globales aunque no muevan mínimos", () => {
    const resultado = calcularMinimos({
      ...baseInput,
      abonoGlobal: 100,
      abonoMinimosGlobal: false,
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.baseEfectiva).toBe(732);
    expect(resultado.abonoGlobalIngresado).toBe(100);
    expect(resultado.abonoGlobalAplicado).toBe(0);
    expect(resultado.terminoOriginal).toBe("23/09/2021");

    expect(resultado.tmFraccionDias).toBe(488);
    expect(resultado.tmDiasAplicados).toBe(488);
    expect(resultado.tmFechaInclusiva).toBe("02/05/2021");
    expect(resultado.tmFechaVista).toBe("03/05/2021");
  });

  it("calcula regimen 1/2 simple sin abonos", () => {
    const resultado = calcularMinimos({
      inicio: "15/07/2021",
      causas: [
        { anios: 0, meses: 6, dias: 0 },
      ],
      encadenado: "dia_siguiente",
      regimen: "1/2",
      vista: "oficial",
      abonoGlobal: 0,
      abonoMinimosGlobal: false,
      roundingMode: "residual",
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.totalDiasBrutos).toBe(185);
    expect(resultado.baseEfectiva).toBe(185);
    expect(resultado.terminoOriginal).toBe("15/01/2022");

    expect(resultado.tmFraccionDias).toBeCloseTo(92.5);
    expect(resultado.tmDiasAplicados).toBe(93);
    expect(resultado.tmFechaInclusiva).toBe("15/10/2021");
    expect(resultado.tmFechaVista).toBe("16/10/2021");

    expect(resultado.tmbi).toBe("16/10/2020");
    expect(resultado.diasInicioATmbi).toBe(0);

    expect(resultado.cetFraccionDias).toBe(0);
    expect(resultado.cetDiasAplicados).toBe(0);
    expect(resultado.cetFechaInclusiva).toBe("");
    expect(resultado.cetFechaVista).toBe("");
  });
});
