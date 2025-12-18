// src/CalculadoraCondenas.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AbonosDistribucion from "./components/AbonosDistribucion";
import DisclaimerModal from "./components/DisclaimerModal";
import FeedbackSlideOver from "./components/FeedbackSlideOver";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  EncadenadoMode,
  Regimen,
  RoundingMode,
  addDaysUTC,
  addYearsMonthsUTC,
  calcularMinimos,
  diffDaysInclusiveUTC,
  encadenarExpediente,
  fmtDMY,
  finDeCausa,
  parseDMYtoUTC,
  roundWithMode,
  CausaCalculo,
} from "./core/minimos";

/** Contenedor de errores para aislar fallos del módulo de distribución */
class UIErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: err?.message || String(err) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            border: "1px dashed #ef4444",
            background: "#fff1f2",
            color: "#991b1b",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
          }}
        >
          El módulo de distribución presentó un problema y fue aislado para no
          interrumpir la aplicación. Puedes continuar usando el resto de la app.
        </div>
      );
    }
    return this.props.children as any;
  }
}

/* ===== Config GAS (mantener) ===== */
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzBGBDwxIQghdRUf9ssxw_sA2vagbwuyr-j2E8Fqx5cNtWpRKFAFVNl4F5CuLp89sRN/exec";

/* ===== Tipos ===== */
type Causa = CausaCalculo & {
  id: string;
  regimen: Regimen;
  nombre?: string;
};
type Resultados = {
  terminoOriginal: string;
  tm: string;
  tmbi: string;
  tmCet: string;
  _debug?: {
    diasBrutosTotales: number;
    diasConAbonosTermino: number; // Base efectiva (incluye global)
  };
};

/* ===== Constantes ===== */
const STORAGE_KEY = "calc_state_v6";

/* ===== UI helpers ===== */
const chip = (text: string) => (
  <span
    title={text}
    style={{
      display: "inline-block",
      fontSize: 11,
      padding: "2px 8px",
      borderRadius: 999,
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      color: "#111827",
      lineHeight: 1.6,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

/* ===== Utilidades varias ===== */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/* =================== Componente =================== */
export default function CalculadoraCondenas() {
  /* Formulario base */
  const [inicio, setInicio] = useState("");
  const [encadenado, setEncadenado] =
    useState<EncadenadoMode>("dia_siguiente");
  const [regimenGlobal, setRegimenGlobal] = useState<Regimen>("2/3");
  const [vistaMinimos, setVistaMinimos] =
    useState<"oficial" | "doctrinal">("oficial");

  /* Causas */
  const [causas, setCausas] = useState<Causa[]>([]);
  const [ordenarGravosaPrimero, setOrdenarGravosaPrimero] = useState(true);

  /* Opciones avanzadas */
  const [abonosTotalesExpediente, setAbonosTotalesExpediente] = useState(0);
  const [abonoMinimosGlobal, setAbonoMinimosGlobal] = useState(true);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("residual");

  // Ingresos manuales (operativa): TM y TMBI (opcionales)
  const [tmIngresado, setTmIngresado] = useState<string>("");
  const [tmbiIngresado, setTmbiIngresado] = useState<string>("");

  // Ajustes finos (±1) de presentación
  const [tmAjuste, setTmAjuste] = useState<-1 | 0 | 1>(0);
  const [cetAjuste, setCetAjuste] = useState<-1 | 0 | 1>(0);

  // Fecha esperable de término (sugerencias)
  const [toObjetivo, setToObjetivo] = useState<string>("");

  // Sugerencia de distribución
  const [sugeridos, setSugeridos] = useState<
    { id: string; nuevoAbono: number }[] | null
  >(null);
  const [sugerenciaInfo, setSugerenciaInfo] = useState<{
    mensaje: string;
    tipo: "ok" | "warn" | "error";
  } | null>(null);

  /* Confirmación eliminar causa */
  const [confirm, setConfirm] = useState<{ open: boolean; id: string | null }>(
    { open: false, id: null }
  );
  const openConfirm = (id: string) => setConfirm({ open: true, id });
  const closeConfirm = () => setConfirm({ open: false, id: null });
  const confirmRemove = () => {
    if (!confirm.id) return;
    setCausas((prev) => prev.filter((c) => c.id !== confirm.id));
    closeConfirm();
  };

  /* Toast accesible */
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToast({ message });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2500);
  };
  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  /* Recuerdo de plegado */
  const [manualCalculoOpen, setManualCalculoOpen] = React.useState<boolean>(
    () => {
      try {
        const nuevo = localStorage.getItem("manualCalculoOpen");
        if (nuevo === "1" || nuevo === "0") return nuevo === "1";
        return localStorage.getItem("ejemploOpen") === "1";
      } catch {
        return false;
      }
    }
  );
  const [detalleCalculoOpen, setDetalleCalculoOpen] = React.useState<boolean>(
    () => {
      try {
        return localStorage.getItem("detalleCalculoOpen") === "1";
      } catch {
        return false;
      }
    }
  );
  const [definicionesOpen, setDefinicionesOpen] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("definicionesOpen") === "1";
    } catch {
      return false;
    }
  });
  const [abonarOpen, setAbonarOpen] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("abonarOpen") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("manualCalculoOpen", manualCalculoOpen ? "1" : "0");
    } catch {}
  }, [manualCalculoOpen]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "detalleCalculoOpen",
        detalleCalculoOpen ? "1" : "0"
      );
    } catch {}
  }, [detalleCalculoOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("definicionesOpen", definicionesOpen ? "1" : "0");
    } catch {}
  }, [definicionesOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("abonarOpen", abonarOpen ? "1" : "0");
    } catch {}
  }, [abonarOpen]);

  /* Autoguardado (load) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s?.inicio === "string") setInicio(s.inicio);
      if (s?.encadenado) setEncadenado(s.encadenado);
      if (s?.regimenGlobal) setRegimenGlobal(s.regimenGlobal);
      if (s?.vistaMinimos) setVistaMinimos(s.vistaMinimos);
      if (Array.isArray(s?.causas)) setCausas(s.causas);
      if (typeof s?.ordenarGravosaPrimero === "boolean")
        setOrdenarGravosaPrimero(s.ordenarGravosaPrimero);
      if (typeof s?.abonosTotalesExpediente === "number")
        setAbonosTotalesExpediente(s.abonosTotalesExpediente);
      if (typeof s?.abonoMinimosGlobal === "boolean")
        setAbonoMinimosGlobal(s.abonoMinimosGlobal);
      if (typeof s?.roundingMode === "string") {
        const valid: RoundingMode[] = ["residual", "truncado", "matematico"];
        if (valid.includes(s.roundingMode)) setRoundingMode(s.roundingMode);
      }
      if (typeof s?.tmIngresado === "string") setTmIngresado(s.tmIngresado);
      if (typeof s?.tmbiIngresado === "string")
        setTmbiIngresado(s.tmbiIngresado);
      if (typeof s?.toObjetivo === "string") setToObjetivo(s.toObjetivo);
      if (typeof s?.tmAjuste === "number")
        setTmAjuste(clamp(s.tmAjuste, -1, 1) as any);
      if (typeof s?.cetAjuste === "number")
        setCetAjuste(clamp(s.cetAjuste, -1, 1) as any);
    } catch {}
  }, []);

  /* Autoguardado (save) */
  useEffect(() => {
    const payload = {
      inicio,
      encadenado,
      regimenGlobal,
      vistaMinimos,
      causas,
      ordenarGravosaPrimero,
      abonosTotalesExpediente,
      abonoMinimosGlobal,
      roundingMode,
      tmIngresado,
      tmbiIngresado,
      toObjetivo,
      tmAjuste,
      cetAjuste,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [
    inicio,
    encadenado,
    regimenGlobal,
    vistaMinimos,
    causas,
    ordenarGravosaPrimero,
    abonosTotalesExpediente,
    abonoMinimosGlobal,
    roundingMode,
    tmIngresado,
    tmbiIngresado,
    toObjetivo,
    tmAjuste,
    cetAjuste,
  ]);

  const regimenSugeridoPorCausas = useMemo<Regimen>(() => {
    if (causas.length === 0) return "2/3";
    return causas.some((c) => c.regimen === "2/3") ? "2/3" : "1/2";
  }, [causas]);

  /* Derivado: régimen aplicado (informativo) */
  const regimenAplicado = useMemo<Regimen>(() => {
    if (!regimenGlobal) return "2/3";
    return regimenGlobal;
  }, [regimenGlobal]);

  const duracionCausaRealDias = useCallback(
    (c: Causa) => {
      const ini = parseDMYtoUTC(inicio);
      if (!ini) return 0;
      const fin = finDeCausa(ini, c.anios || 0, c.meses || 0, c.dias || 0);
      return diffDaysInclusiveUTC(ini, fin);
    },
    [inicio]
  );

  /* Orden visual de causas */
  const causasOrdenadas = useMemo(() => {
    const withLen = causas.map((c) => ({
      ...c,
      len: duracionCausaRealDias(c),
    }));
    if (!ordenarGravosaPrimero) return withLen;
    return [...withLen].sort((a, b) => b.len - a.len);
  }, [causas, ordenarGravosaPrimero, duracionCausaRealDias]);

  const causasCalculo = useMemo<CausaCalculo[]>(() => {
    return causasOrdenadas.map((c) => ({
      anios: Math.max(0, Number(c.anios) || 0),
      meses: Math.max(0, Number(c.meses) || 0),
      dias: Math.max(0, Number(c.dias) || 0),
      abonoCausa: Math.max(0, Number(c.abonoCausa) || 0),
    }));
  }, [causasOrdenadas]);

  /* Auto-slash en fechas */
  const autoSlash = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const inicioValido = useMemo(
    () => /^(\d{2})\/(\d{2})\/(\d{4})$/.test(inicio),
    [inicio]
  );

  /* Cálculo del encadenado bruto y con abonos por causa */
  const chainActual = useMemo(() => {
    if (!inicio || causasCalculo.length === 0)
      return null as null | ReturnType<typeof encadenarExpediente>;
    return encadenarExpediente(causasCalculo, inicio, encadenado);
  }, [inicio, causasCalculo, encadenado]);

  /* ===== Base normativa estricta =====
     Base efectiva = (suma causas con abonos por causa) − abono global  */
  const abonoGlobalAplicado = useMemo(
    () => (abonoMinimosGlobal ? Math.max(0, abonosTotalesExpediente || 0) : 0),
    [abonoMinimosGlobal, abonosTotalesExpediente]
  );

  const baseEfectivaDias = useMemo(() => {
    if (!chainActual) return 0;
    return Math.max(0, (chainActual.totalConAbonos || 0) - abonoGlobalAplicado);
  }, [chainActual, abonoGlobalAplicado]);

  const calculoPasoAPaso = useMemo(
    () =>
      calcularMinimos({
        inicio,
        causas: causasCalculo,
        encadenado,
        regimen: regimenAplicado,
        vista: vistaMinimos,
        abonoGlobal: abonosTotalesExpediente,
        abonoMinimosGlobal,
        roundingMode,
      }),
    [
      inicio,
      causasCalculo,
      encadenado,
      regimenAplicado,
      vistaMinimos,
      abonosTotalesExpediente,
      abonoMinimosGlobal,
      roundingMode,
    ]
  );

  /* TO normativo: Inicio + (Base efectiva − 1) */
  const toNormativo = calculoPasoAPaso.terminoOriginal || "";

  const tmDatos = useMemo(() => {
    const ratio = regimenAplicado === "1/2" ? 1 / 2 : 2 / 3;
    const fraccion = baseEfectivaDias * ratio;
    const dias =
      baseEfectivaDias > 0
        ? Math.max(0, roundWithMode(fraccion, roundingMode))
        : 0;
    return { ratio, fraccion, dias };
  }, [baseEfectivaDias, regimenAplicado, roundingMode]);

  /* TM/TMBI/CET automáticos (con override manual opcional en TM/TMBI) */
  const tmAuto = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    if (!ini || baseEfectivaDias <= 0 || tmDatos.dias <= 0) return "";

    // Vista Oficial: equivalente exclusiva (día 1 = día siguiente)
    const startForTM = vistaMinimos === "oficial" ? addDaysUTC(ini, 1) : ini;
    const llegada = addDaysUTC(startForTM, Math.max(0, tmDatos.dias - 1));
    return fmtDMY(llegada);
  }, [inicio, baseEfectivaDias, vistaMinimos, tmDatos.dias]);

  const tmMostrado = useMemo(
    () => (tmIngresado ? tmIngresado : tmAuto),
    [tmIngresado, tmAuto]
  );

  // TMBI desde TM (manual o auto) – normativa: TM − 12 meses (con fin de mes)
  const tmbiAuto = useMemo(() => {
    const tmD = parseDMYtoUTC(tmMostrado || tmAuto);
    if (!tmD) return "";
    return fmtDMY(addYearsMonthsUTC(tmD, -1, 0));
  }, [tmMostrado, tmAuto]);

  const tmbiMostrado = useMemo(
    () => (tmbiIngresado ? tmbiIngresado : tmbiAuto),
    [tmbiIngresado, tmbiAuto]
  );

  // CET automático desde Inicio → TMBI (inclusivo) con ceil
  const cetAuto = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    const tmbi = parseDMYtoUTC(tmbiMostrado);
    if (!ini || !tmbi) return "";
    const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
    const diasCET = Math.ceil(L * (2 / 3)); // recomendación: ceil
    const llegada = addDaysUTC(ini, Math.max(0, diasCET - 1));
    const mostrar =
      vistaMinimos === "oficial" ? addDaysUTC(llegada, -1) : llegada;
    return fmtDMY(mostrar);
  }, [inicio, tmbiMostrado, vistaMinimos]);

  /* Ajuste fino (±1) solo de presentación (no toca base) */
  const tmDisplay = useMemo(() => {
    const d = parseDMYtoUTC(tmMostrado);
    if (!d) return "";
    return fmtDMY(addDaysUTC(d, tmAjuste));
  }, [tmMostrado, tmAjuste]);

  const cetDisplay = useMemo(() => {
    const d = parseDMYtoUTC(cetAuto);
    if (!d) return "";
    return fmtDMY(addDaysUTC(d, cetAjuste));
  }, [cetAuto, cetAjuste]);

  /* Métricas auxiliares (L y CET días) */
  const metricas = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    const tmbi = parseDMYtoUTC(tmbiMostrado);
    if (!ini || !tmbi)
      return null as null | { L: number; cetFraccion: number; diasCET: number };
    const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
    const cetFraccion = L * (2 / 3);
    const diasCET = Math.max(0, roundWithMode(cetFraccion, roundingMode));
    return { L, cetFraccion, diasCET };
  }, [inicio, tmbiMostrado, roundingMode]);

  const roundingModeLabels: Record<RoundingMode, string> = useMemo(
    () => ({
      residual: "Residual (oficial, aproxima hacia arriba)",
      truncado: "Truncado (solo enteros hacia abajo)",
      matematico: "Matemático (≥0,5 sube)",
    }),
    []
  );

  /* Totales de abonos */
  const totalAbonosPorCausa = useMemo(
    () => causas.reduce((s, c) => s + Math.max(0, c.abonoCausa || 0), 0),
    [causas]
  );
  const totalAbonosGlobal = useMemo(
    () => Math.max(0, abonosTotalesExpediente || 0),
    [abonosTotalesExpediente]
  );
  const totalAbonosTodos = totalAbonosPorCausa + totalAbonosGlobal;

  const formatDecimal = useCallback((n: number) => {
    if (!Number.isFinite(n)) return "—";
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d*?)0+$/, "$1");
  }, []);

  const manualCalculoInfo = useMemo(() => {
    if (!inicio || causasCalculo.length === 0) {
      return {
        listo: false,
        mensaje:
          "Ingresa Inicio y al menos una causa para ver el cálculo paso a paso.",
        pasos: [] as React.ReactNode[],
        copy: "Sin cálculo disponible.",
        data: null as null | Record<string, unknown>,
      };
    }

    const encLabel =
      encadenado === "dia_siguiente"
        ? "Oficial (día siguiente)"
        : "Doctrinal (mismo día)";
    const vistaLabel =
      vistaMinimos === "oficial"
        ? "Oficial (exclusiva)"
        : "Doctrinal (inclusiva)";
    const ordenLabel = ordenarGravosaPrimero
      ? "automático (más gravosa primero)"
      : "manual (según ingreso)";

    const ratioNum = regimenAplicado === "1/2" ? 1 : 2;
    const ratioDen = regimenAplicado === "1/2" ? 2 : 3;
    const ratioLabel = `${ratioNum}/${ratioDen}`;

    const totalBrutos = calculoPasoAPaso.totalDiasBrutos;
    const totalTrasCausa = calculoPasoAPaso.totalTrasAbonosCausa;
    const base = baseEfectivaDias;
    const tmFraccion = tmDatos.fraccion;
    const tmDiasAplicados = tmDatos.dias;
    const tmAutoInclusivo = calculoPasoAPaso.tmFechaInclusiva || "—";
    const tmAutoVista = calculoPasoAPaso.tmFechaVista || "—";
    const tmVistaActual = tmDisplay || "—";
    const tmbiAuto = calculoPasoAPaso.tmbi || "—";
    const tmbiActual = tmbiMostrado || "—";
    const diasInicioATmbi = metricas?.L ?? calculoPasoAPaso.diasInicioATmbi;
    const cetFraccion =
      metricas?.cetFraccion ?? calculoPasoAPaso.cetFraccionDias;
    const cetDiasAplicados =
      metricas?.diasCET ?? calculoPasoAPaso.cetDiasAplicados;
    const cetAutoVista = calculoPasoAPaso.cetFechaVista || "—";
    const cetVistaActual = cetDisplay || "—";
    const cetInclusivoAuto = calculoPasoAPaso.cetFechaInclusiva || "—";

    const abonoGlobalTexto = abonoMinimosGlobal
      ? `${abonoGlobalAplicado} días aplicados a mínimos`
      : `${totalAbonosGlobal} días (referencia, sin mover mínimos)`;

    const manualOverrides: string[] = [];
    if (tmIngresado) manualOverrides.push(`TM manual: ${tmIngresado}`);
    if (tmbiIngresado) manualOverrides.push(`TMBI manual: ${tmbiIngresado}`);
    if (tmAjuste !== 0)
      manualOverrides.push(`Ajuste TM ${tmAjuste > 0 ? "+" : ""}${tmAjuste}`);
    if (cetAjuste !== 0)
      manualOverrides.push(`Ajuste CET ${cetAjuste > 0 ? "+" : ""}${cetAjuste}`);

    if (base <= 0 || tmDiasAplicados <= 0) {
      return {
        listo: false,
        mensaje:
          "Base efectiva sin días disponibles. Revisa abonos globales o por causa.",
        pasos: [] as React.ReactNode[],
        copy: "Base efectiva sin días disponibles.",
        data: null,
      };
    }

    const pasos: React.ReactNode[] = [
      (
        <li key="config" style={{ marginBottom: 8 }}>
          <strong>1) Configuración base.</strong> Inicio = <b>{inicio}</b>. Encadenado:
          <b> {encLabel}</b>. Vista de mínimos: <b>{vistaLabel}</b>. Redondeo:
          <b> {roundingModeLabels[roundingMode]}</b>. Orden de causas:
          <b> {ordenLabel}</b>. Abono global: <b>{abonoGlobalTexto}</b>.
        </li>
      ),
      (
        <li key="base" style={{ marginBottom: 8 }}>
          <strong>2) Suma de días.</strong> Brutos encadenados =
          <b> {totalBrutos}</b> días. Abonos por causa =
          <b> {totalAbonosPorCausa}</b> → Tras abonos por causa =
          <b> {totalTrasCausa}</b> días. Base efectiva =
          <b> {base}</b> días.
        </li>
      ),
      (
        <li key="tm" style={{ marginBottom: 8 }}>
          <strong>3) TM.</strong> TMd = <b>{base}</b> × <b>{ratioLabel}</b> =
          <b> {formatDecimal(tmFraccion)}</b> → <b>{tmDiasAplicados} días</b> ({
            roundingModeLabels[roundingMode]
          }). TM inclusivo (auto): <b>{tmAutoInclusivo}</b>. Vista {vistaLabel}:
          <b> {tmAutoVista}</b>. TM mostrado: <b>{tmVistaActual}</b>.
        </li>
      ),
      (
        <li key="tmbi" style={{ marginBottom: 8 }}>
          <strong>4) TMBI.</strong> Auto = <b>{tmbiAuto}</b>. Mostrado =
          <b> {tmbiActual}</b>. Días Inicio→TMBI =
          <b> {diasInicioATmbi}</b> días.
        </li>
      ),
      (
        <li key="cet" style={{ marginBottom: 8 }}>
          <strong>5) TM CET.</strong> CETd = <b>{diasInicioATmbi}</b> × <b>2/3</b>
          = <b>{formatDecimal(cetFraccion)}</b> → <b>{cetDiasAplicados} días</b> ({
            roundingModeLabels[roundingMode]
          }). CET inclusivo (auto): <b>{cetInclusivoAuto}</b>. Vista {vistaLabel}:
          <b> {cetAutoVista}</b>. CET mostrado: <b>{cetVistaActual}</b>.
        </li>
      ),
    ];

    if (manualOverrides.length) {
      pasos.push(
        <li key="overrides" style={{ marginBottom: 8 }}>
          <strong>6) Ajustes manuales.</strong> {manualOverrides.join(" · ")}
        </li>
      );
    }

    const copyLines = [
      "¿Cómo se calculó?",
      `Inicio=${inicio}. Encadenado=${encLabel}. Vista=${vistaLabel}. Redondeo=${roundingModeLabels[roundingMode]}. Orden=${ordenLabel}.`,
      `Brutos=${totalBrutos} días. Abonos por causa=${totalAbonosPorCausa}. Tras abonos por causa=${totalTrasCausa}. Base efectiva=${base}.`,
      `Abono global=${abonoGlobalTexto}.`,
      `TMd=${base}×${ratioLabel}=${formatDecimal(tmFraccion)} → ${tmDiasAplicados} días (${roundingModeLabels[roundingMode]}). TM inclusivo auto=${tmAutoInclusivo}. Vista ${vistaLabel} auto=${tmAutoVista}. TM mostrado=${tmVistaActual}.`,
      `TMBI auto=${tmbiAuto}. TMBI mostrado=${tmbiActual}. Días Inicio→TMBI=${diasInicioATmbi}.`,
      `CETd=${diasInicioATmbi}×2/3=${formatDecimal(cetFraccion)} → ${cetDiasAplicados} días (${roundingModeLabels[roundingMode]}). CET inclusivo auto=${cetInclusivoAuto}. Vista ${vistaLabel} auto=${cetAutoVista}. CET mostrado=${cetVistaActual}.`,
    ];
    if (manualOverrides.length) {
      copyLines.push(`Ajustes/manuales: ${manualOverrides.join(" · ")}.`);
    }

    return {
      listo: true,
      mensaje: "",
      pasos,
      copy: copyLines.join("\n"),
      data: {
        encLabel,
        vistaLabel,
        ordenLabel,
        roundingLabel: roundingModeLabels[roundingMode],
        totalBrutos,
        totalTrasCausa,
        base,
        abonoGlobalTexto,
        abonoMinimosGlobal,
        abonoGlobalAplicado,
        totalAbonosPorCausa,
        totalAbonosGlobal,
        tmFraccion,
        tmDiasAplicados,
        ratioLabel,
        tmAutoInclusivo,
        tmAutoVista,
        tmVistaActual,
        diasInicioATmbi,
        tmbiAuto,
        tmbiActual,
        cetFraccion,
        cetDiasAplicados,
        cetAutoVista,
        cetVistaActual,
        cetInclusivoAuto,
        manualOverrides,
      },
    };
  }, [
    inicio,
    causasCalculo,
    encadenado,
    vistaMinimos,
    ordenarGravosaPrimero,
    calculoPasoAPaso,
    baseEfectivaDias,
    tmDatos,
    tmDisplay,
    cetDisplay,
    roundingMode,
    roundingModeLabels,
    totalAbonosPorCausa,
    totalAbonosGlobal,
    abonoGlobalAplicado,
    abonoMinimosGlobal,
    tmIngresado,
    tmbiIngresado,
    tmAjuste,
    cetAjuste,
    tmbiMostrado,
    metricas,
    regimenAplicado,
    formatDecimal,
  ]);

  const detalleCalculoInfo = useMemo(() => {
    if (!manualCalculoInfo.listo || !manualCalculoInfo.data) {
      return {
        listo: false,
        bloques: [] as {
          titulo: string;
          filas: { etiqueta: string; valor: string }[];
        }[],
        copy: "Sin detalle disponible.",
      };
    }

    const data = manualCalculoInfo.data as Record<string, any>;

    const bloques = [
      {
        titulo: "Base del expediente",
        filas: [
          { etiqueta: "Inicio", valor: inicio || "—" },
          { etiqueta: "Encadenado", valor: data.encLabel as string },
          { etiqueta: "Vista de mínimos", valor: data.vistaLabel as string },
          { etiqueta: "Redondeo", valor: data.roundingLabel as string },
          { etiqueta: "Orden de causas", valor: data.ordenLabel as string },
          {
            etiqueta: "Total días brutos",
            valor: String(data.totalBrutos ?? "—"),
          },
          {
            etiqueta: "Abonos por causa",
            valor: String(data.totalAbonosPorCausa ?? "—"),
          },
          {
            etiqueta: "Tras abonos por causa",
            valor: String(data.totalTrasCausa ?? "—"),
          },
          {
            etiqueta: "Abono global",
            valor: data.abonoGlobalTexto as string,
          },
          { etiqueta: "Base efectiva", valor: String(data.base ?? "—") },
        ],
      },
      {
        titulo: "Tiempo mínimo (TM)",
        filas: [
          {
            etiqueta: "TMd (fracción)",
            valor: `${data.base} × ${data.ratioLabel} = ${formatDecimal(
              data.tmFraccion as number
            )}`,
          },
          {
            etiqueta: "TM días aplicados",
            valor: String(data.tmDiasAplicados ?? "—"),
          },
          {
            etiqueta: "TM inclusivo (auto)",
            valor: data.tmAutoInclusivo as string,
          },
          {
            etiqueta: "TM vista (auto)",
            valor: data.tmAutoVista as string,
          },
          {
            etiqueta: "TM mostrado",
            valor: data.tmVistaActual as string,
          },
        ],
      },
      {
        titulo: "TMBI",
        filas: [
          { etiqueta: "TMBI auto", valor: data.tmbiAuto as string },
          { etiqueta: "TMBI mostrado", valor: data.tmbiActual as string },
          {
            etiqueta: "Días Inicio→TMBI",
            valor: String(data.diasInicioATmbi ?? "—"),
          },
        ],
      },
      {
        titulo: "TM CET",
        filas: [
          {
            etiqueta: "CETd (fracción)",
            valor: `${data.diasInicioATmbi} × 2/3 = ${formatDecimal(
              data.cetFraccion as number
            )}`,
          },
          {
            etiqueta: "CET días aplicados",
            valor: String(data.cetDiasAplicados ?? "—"),
          },
          {
            etiqueta: "CET inclusivo (auto)",
            valor: data.cetInclusivoAuto as string,
          },
          {
            etiqueta: "CET vista (auto)",
            valor: data.cetAutoVista as string,
          },
          {
            etiqueta: "CET mostrado",
            valor: data.cetVistaActual as string,
          },
        ],
      },
    ];

    if ((data.manualOverrides as string[])?.length) {
      bloques.push({
        titulo: "Ajustes manuales",
        filas: (
          data.manualOverrides as string[]
        ).map((texto, idx) => ({ etiqueta: `(${idx + 1})`, valor: texto })),
      });
    }

    const detalleLines = [
      "Detalle del cómputo:",
      `Inicio=${inicio}. Encadenado=${data.encLabel}. Vista=${data.vistaLabel}. Redondeo=${data.roundingLabel}. Orden=${data.ordenLabel}.`,
      `Total brutos=${data.totalBrutos}. Tras abonos por causa=${data.totalTrasCausa}. Base efectiva=${data.base}.`,
      `TMd=${data.base}×${data.ratioLabel}=${formatDecimal(data.tmFraccion as number)} → ${data.tmDiasAplicados} días. TM inclusivo=${data.tmAutoInclusivo}. TM vista=${data.tmAutoVista}. TM mostrado=${data.tmVistaActual}.`,
      `TMBI auto=${data.tmbiAuto}. TMBI mostrado=${data.tmbiActual}. Días Inicio→TMBI=${data.diasInicioATmbi}.`,
      `CETd=${data.diasInicioATmbi}×2/3=${formatDecimal(data.cetFraccion as number)} → ${data.cetDiasAplicados} días. CET inclusivo=${data.cetInclusivoAuto}. CET vista=${data.cetAutoVista}. CET mostrado=${data.cetVistaActual}.`,
    ];
    if ((data.manualOverrides as string[])?.length) {
      detalleLines.push(
        `Ajustes manuales: ${(data.manualOverrides as string[]).join(" · ")}.`
      );
    }

    return {
      listo: true,
      bloques,
      copy: detalleLines.join("\n"),
    };
  }, [manualCalculoInfo, inicio, formatDecimal]);

  /* Resultados para tarjetas */
  const resultados = useMemo<Resultados>(() => {
    return {
      terminoOriginal: toNormativo || "",
      tm: tmDisplay || "",
      tmbi: tmbiMostrado || "",
      tmCet: cetDisplay || "",
      _debug: calculoPasoAPaso.valido
        ? {
            diasBrutosTotales: calculoPasoAPaso.totalDiasBrutos,
            diasConAbonosTermino: baseEfectivaDias,
          }
        : chainActual
        ? {
            diasBrutosTotales: chainActual.totalBrutos,
            diasConAbonosTermino: baseEfectivaDias,
          }
        : undefined,
  };
  }, [
    toNormativo,
    tmDisplay,
    tmbiMostrado,
    cetDisplay,
    calculoPasoAPaso,
    chainActual,
    baseEfectivaDias,
  ]);

  /* Handlers causas */
  const handleAgregarCausa = () => {
    const id =
      (globalThis as any).crypto?.randomUUID?.() || String(Date.now());
    setCausas((p) => [
      ...p,
      { id, anios: 0, meses: 0, dias: 0, abonoCausa: 0, regimen: "1/2" },
    ]);
  };
  const handleChangeCausa = (
    id: string,
    field: keyof Causa,
    value: number | string
  ) => {
    setCausas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };
  const handleRemoveCausa = (id: string) => openConfirm(id);
  const moveCausa = (id: string, delta: -1 | 1) => {
    if (ordenarGravosaPrimero) return;
    setCausas((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  /* Sugerencia simple a TO objetivo (opcional) */
  const [simulados, setSimulados] = useState<Resultados | null>(null);
  const sugerirDistribucion = () => {
    setSugeridos(null);
    setSimulados(null);
    setSugerenciaInfo(null);

    const ini = parseDMYtoUTC(inicio);
    const objetivo = parseDMYtoUTC(toObjetivo);
    if (!ini || !objetivo || causasOrdenadas.length === 0) {
      setSugerenciaInfo({
        tipo: "error",
        mensaje:
          "Debes ingresar Inicio, al menos una causa y la Fecha esperable de término (TO objetivo) en formato DD/MM/AAAA.",
      });
      return;
    }
    if (objetivo.getTime() < ini.getTime()) {
      setSugerenciaInfo({
        tipo: "error",
        mensaje: "El TO objetivo no puede ser anterior al Inicio.",
      });
      return;
    }

    // total brutos (sin abonos por causa)
    const totalBrutos = causasOrdenadas.reduce((acc, c) => {
      const fin = finDeCausa(ini, c.anios || 0, c.meses || 0, c.dias || 0);
      return acc + diffDaysInclusiveUTC(ini, fin);
    }, 0);

    // Días deseados según encadenado (inclusivo + ajuste doctrinal)
    const diffObj = diffDaysInclusiveUTC(ini, objetivo);
    const neededDurSum =
      encadenado === "dia_siguiente"
        ? diffObj
        : diffObj + (causasOrdenadas.length - 1);

    const abonosNecesarios = totalBrutos - neededDurSum;

    if (abonosNecesarios < 0) {
      setSugerenciaInfo({
        tipo: "error",
        mensaje:
          "El TO objetivo es posterior al posible sin abonos por causa. No es alcanzable reduciendo días.",
      });
      return;
    }

    // Estrategia greedy: más gravosa primero
    const sorted = [...causasOrdenadas].sort(
      (a, b) => duracionCausaRealDias(b) - duracionCausaRealDias(a)
    );
    let rem = abonosNecesarios;
    const dish: { id: string; nuevoAbono: number }[] = sorted.map((c) => ({
      id: c.id,
      nuevoAbono: 0,
    }));

    for (let i = 0; i < sorted.length && rem > 0; i++) {
      const c = sorted[i];
      const maxC = duracionCausaRealDias(c);
      const take = Math.min(rem, maxC);
      const idx = dish.findIndex((d) => d.id === c.id);
      dish[idx].nuevoAbono = take;
      rem -= take;
    }

    const sugeridosOrdenOriginal = causasOrdenadas.map((c) => {
      const e = dish.find((d) => d.id === c.id)!;
      return { id: c.id, nuevoAbono: e.nuevoAbono };
    });

    setSugeridos(sugeridosOrdenOriginal);

    const prev = previsualizarConAbonos(sugeridosOrdenOriginal);
    setSimulados(prev);

    if (prev.terminoOriginal === fmtDMY(objetivo)) {
      setSugerenciaInfo({
        tipo: "ok",
        mensaje:
          "Distribución sugerida calculada. El TO simulado coincide con el objetivo.",
      });
    } else {
      setSugerenciaInfo({
        tipo: "warn",
        mensaje:
          "Se propuso una distribución, pero el TO simulado no coincide exactamente con el objetivo. Ajusta manualmente algunos abonos.",
      });
    }
  };

  function previsualizarConAbonos(
    updates: { id: string; nuevoAbono: number }[]
  ): Resultados {
    const ini = parseDMYtoUTC(inicio);
    if (!ini || causasOrdenadas.length === 0)
      return { terminoOriginal: "", tm: "", tmbi: "", tmCet: "" };

    const causasTemp = causasOrdenadas.map((c) => {
      const up = updates.find((u) => u.id === c.id);
      return up ? { ...c, abonoCausa: up.nuevoAbono } : c;
    });
    const tmbi = parseDMYtoUTC(tmbiMostrado);
    const cet = (() => {
      if (!ini || !tmbi) return "";
      const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
      const diasCET = Math.ceil(L * (2 / 3));
      const fechaCET = addDaysUTC(ini, Math.max(0, diasCET - 1));
      const mostrar =
        vistaMinimos === "oficial" ? addDaysUTC(fechaCET, -1) : fechaCET;
      return fmtDMY(mostrar);
    })();

    const chain = encadenarExpediente(causasTemp, inicio, encadenado);
    if (!chain) {
      return {
        terminoOriginal: "",
        tm: tmDisplay || "",
        tmbi: tmbiMostrado || "",
        tmCet: cet,
        _debug: {
          diasBrutosTotales: 0,
          diasConAbonosTermino: 0,
        },
      };
    }

    const D_eff = Math.max(
      0,
      (chain.totalConAbonos || 0) - (abonosTotalesExpediente || 0)
    );
    const toPrev = D_eff > 0 ? fmtDMY(addDaysUTC(ini, D_eff - 1)) : "";

    return {
      terminoOriginal: toPrev,
      tm: tmDisplay || "",
      tmbi: tmbiMostrado || "",
      tmCet: cet,
      _debug: {
        diasBrutosTotales: chain.totalBrutos,
        diasConAbonosTermino: D_eff,
      },
    };
  }

  const aplicarSugerencia = () => {
    if (!sugeridos) return;
    setCausas((prev) =>
      prev.map((c) => {
        const up = sugeridos.find((u) => u.id === c.id);
        return up ? { ...c, abonoCausa: up.nuevoAbono } : c;
      })
    );
    setSugeridos(null);
    setSimulados(null);
    setSugerenciaInfo({
      tipo: "ok",
      mensaje: "Distribución aplicada a las causas.",
    });
  };

  const copiarTexto = async (texto: string, mensaje: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      showToast(mensaje);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(mensaje);
      } catch {
        showToast("No se pudo copiar el texto.");
      }
    }
  };

  /* Copiar resumen */
  const copiarResumen = async () => {
    const encStr =
      encadenado === "dia_siguiente"
        ? "Oficial (día siguiente)"
        : "Doctrinal (mismo día)";
    const minStr =
      vistaMinimos === "oficial"
        ? "Oficial (exclusiva)"
        : "Doctrinal (inclusiva)";

    const ajustesStr =
      tmAjuste === 0 && cetAjuste === 0
        ? "—"
        : `TM ${tmAjuste >= 0 ? "+" : ""}${tmAjuste}, CET ${
            cetAjuste >= 0 ? "+" : ""
          }${cetAjuste}`;

    const texto =
      `Resumen de Cómputo (UTC)\n` +
      `Inicio: ${inicio || "—"}\n` +
      `TO: ${resultados.terminoOriginal || "—"}  [Brutos ${
        resultados._debug?.diasBrutosTotales ?? "—"
      } · Base efectiva ${resultados._debug?.diasConAbonosTermino ?? "—"}]\n` +
      `TM: ${resultados.tm || "—"}\n` +
      `TMBI: ${resultados.tmbi || "—"}  [Tramo inclusivo ${
        metricas?.L ?? "—"
      } días]\n` +
      `TM CET: ${resultados.tmCet || "—"}  [Cálculo ${
        metricas?.diasCET ?? "—"
      } días]\n` +
      `Régimen aplicado: ${regimenAplicado} (sugerido por causas: ${regimenSugeridoPorCausas})\n` +
      `Encadenado: ${encStr}\n` +
      `Vista de mínimos: ${minStr}\n` +
      `Ajustes finos aplicados: ${ajustesStr}\n` +
      `Abonos: por causa ${totalAbonosPorCausa} · global ${totalAbonosGlobal} · total ${totalAbonosTodos}\n` +
      `Criterio de redondeo: ${roundingModeLabels[roundingMode]}\n` +
      `Abonos globales aplican a mínimos: ${abonoMinimosGlobal ? "Sí" : "No"}\n`;
    return copiarTexto(texto, "Resumen copiado al portapapeles.");
  };

  /* Exportar CSV (Excel, separador ;) */
  const exportarCSV = () => {
    const sep = ";";
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return s.includes(sep) || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines: string[] = [];

    lines.push(["Sección", "Campo", "Valor"].join(sep));
    lines.push(["Resumen", "Inicio", esc(inicio)].join(sep));
    lines.push(["Resumen", "TO", esc(resultados.terminoOriginal)].join(sep));
    lines.push(["Resumen", "TM", esc(resultados.tm)].join(sep));
    lines.push(["Resumen", "TMBI", esc(resultados.tmbi)].join(sep));
    lines.push(["Resumen", "TM CET", esc(resultados.tmCet)].join(sep));
    lines.push(["Resumen", "Régimen aplicado", esc(regimenAplicado)].join(sep));
    lines.push([
      "Resumen",
      "Régimen sugerido por causas",
      esc(regimenSugeridoPorCausas),
    ].join(sep));
    lines.push([
      "Resumen",
      "Encadenado",
      esc(
        encadenado === "dia_siguiente"
          ? "Oficial (día siguiente)"
          : "Doctrinal (mismo día)"
      ),
    ].join(sep));
    lines.push([
      "Resumen",
      "Vista de mínimos",
      esc(
        vistaMinimos === "oficial"
          ? "Oficial (exclusiva)"
          : "Doctrinal (inclusiva)"
      ),
    ].join(sep));
    lines.push([
      "Resumen",
      "Días brutos totales",
      esc(resultados._debug?.diasBrutosTotales ?? ""),
    ].join(sep));
    lines.push([
      "Resumen",
      "Base efectiva (días)",
      esc(resultados._debug?.diasConAbonosTermino ?? ""),
    ].join(sep));
    lines.push([
      "Resumen",
      "Ajustes finos",
      esc(
        tmAjuste === 0 && cetAjuste === 0
          ? "—"
          : `TM ${tmAjuste >= 0 ? "+" : ""}${tmAjuste}, CET ${
              cetAjuste >= 0 ? "+" : ""
            }${cetAjuste}`
      ),
    ].join(sep));
    lines.push(["Resumen", "Abonos por causa", esc(totalAbonosPorCausa)].join(sep));
    lines.push(["Resumen", "Abono global", esc(totalAbonosGlobal)].join(sep));
    lines.push(["Resumen", "Abonos totales", esc(totalAbonosTodos)].join(sep));
    lines.push([
      "Resumen",
      "Criterio de redondeo",
      esc(roundingModeLabels[roundingMode]),
    ].join(sep));
    lines.push([
      "Resumen",
      "Abonos globales aplican mínimos",
      esc(abonoMinimosGlobal ? "Sí" : "No"),
    ].join(sep));

    lines.push("");
    lines.push(
      ["Causas", "ID/Nombre", "Años", "Meses", "Días", "Abono por causa", "Régimen"].join(sep)
    );
    causasOrdenadas.forEach((c) => {
      lines.push(
        [
          "Causas",
          esc(c.nombre || c.id),
          c.anios,
          c.meses,
          c.dias,
          c.abonoCausa,
          c.regimen,
        ].join(sep)
      );
    });

    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expediente.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Export/Import JSON */
  const exportarJSON = () => {
    const data = {
      inicio,
      encadenado,
      regimenGlobal,
      vistaMinimos,
      causas,
      ordenarGravosaPrimero,
      abonosTotalesExpediente,
      tmIngresado,
      tmbiIngresado,
      toObjetivo,
      tmAjuste,
      cetAjuste,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expediente.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileRef = useRef<HTMLInputElement | null>(null);
  const importarJSON = () => fileRef.current?.click();
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result || "{}"));
        if (typeof s.inicio === "string") setInicio(String(s.inicio));
        if (s.encadenado) setEncadenado(s.encadenado);
        if (s.regimenGlobal) setRegimenGlobal(s.regimenGlobal);
        if (s.vistaMinimos) setVistaMinimos(s.vistaMinimos);
        if (Array.isArray(s.causas)) setCausas(s.causas);
        if (typeof s.ordenarGravosaPrimero === "boolean")
          setOrdenarGravosaPrimero(s.ordenarGravosaPrimero);
        if (typeof s.abonosTotalesExpediente === "number")
          setAbonosTotalesExpediente(s.abonosTotalesExpediente);
        if (typeof s.tmIngresado === "string") setTmIngresado(s.tmIngresado);
        if (typeof s.tmbiIngresado === "string")
          setTmbiIngresado(s.tmbiIngresado);
        if (typeof s.toObjetivo === "string") setToObjetivo(s.toObjetivo);
        if (typeof s.tmAjuste === "number")
          setTmAjuste(clamp(s.tmAjuste, -1, 1) as any);
        if (typeof s.cetAjuste === "number")
          setCetAjuste(clamp(s.cetAjuste, -1, 1) as any);
      } catch {
        alert("Archivo inválido.");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  /* Restablecer (no dispara modal) */
  const restablecer = () => {
    try {
      sessionStorage.setItem("skipDisclaimerOnce", "1");
    } catch {}
    setInicio("");
    setTmIngresado("");
    setTmbiIngresado("");
    setToObjetivo("");
    setAbonosTotalesExpediente(0);
    setTmAjuste(0);
    setCetAjuste(0);
    setCausas((prev) =>
      prev.map((c) => ({
        ...c,
        anios: 0,
        meses: 0,
        dias: 0,
        abonoCausa: 0,
      }))
    );
    setSugeridos(null);
    setSimulados(null);
    setSugerenciaInfo(null);
  };

  /* Avisos de coherencia */
  const warnings = (() => {
    const res: string[] = [];
    const ini = parseDMYtoUTC(inicio);
    const to = parseDMYtoUTC(resultados.terminoOriginal);
    const tmD = parseDMYtoUTC(tmMostrado);
    const tmbiD = parseDMYtoUTC(tmbiMostrado);
    const cetD = parseDMYtoUTC(cetAuto);

    if (ini && to && to.getTime() < ini.getTime()) {
      res.push("El TO es anterior al Inicio (verifica entradas).");
    }
    if (ini && tmbiD && tmD && tmbiD.getTime() > tmD.getTime()) {
      res.push("TMBI (auto/manual) quedó posterior al TM.");
    }
    if (tmD && to && tmD.getTime() > to.getTime()) {
      res.push("TM supera el TO.");
    }
    if (cetD && tmbiD && cetD.getTime() > tmbiD.getTime()) {
      res.push("TM CET calculado supera el TMBI.");
    }
    if (
      chainActual &&
      abonoMinimosGlobal &&
      chainActual.totalConAbonos - abonoGlobalAplicado < 0
    ) {
      res.push("La Base Efectiva quedó negativa (revisa abonos globales).");
    }
    return res;
  })();

  /* Etiqueta principal */
  const badgeRegla = `UTC · Mínimos: ${
    vistaMinimos === "oficial"
      ? "Oficial (exclusiva)"
      : "Doctrinal (inclusiva)"
  } · Modo: Normativa · Ajuste fino TM/CET ±1 (opcional)`;

  /* ====== Herramienta auxiliar: Abonar a Fecha (tipo Excel) ====== */
  const [abonarFechaTermino, setAbonarFechaTermino] = useState<string>("");
  const [abonarAnios, setAbonarAnios] = useState<number>(0);
  const [abonarMeses, setAbonarMeses] = useState<number>(0);
  const [abonarDias, setAbonarDias] = useState<number>(0);

  const resultadoAbonarFecha = useMemo(() => {
    const ft = parseDMYtoUTC(abonarFechaTermino);
    if (!ft) return "";
    // Resta Y/M con respeto a fin de mes y luego Días
    const menosYM = addYearsMonthsUTC(ft, -Math.max(0, abonarAnios), -Math.max(0, abonarMeses));
    const menosYMD = addDaysUTC(menosYM, -Math.max(0, abonarDias));
    return fmtDMY(menosYMD);
  }, [abonarFechaTermino, abonarAnios, abonarMeses, abonarDias]);

  /* =================== UI =================== */
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <style>{`@media print{button,summary,details:not([open]){display:none!important} .print-block{break-inside:avoid;}}`}</style>

      {/* Modal de advertencia (siempre al abrir) */}
      <DisclaimerModal />

      {/* CABECERA */}
      <h1 style={{ margin: 0, fontSize: 22 }}>
        Calculadora de Cómputos de Condenas
      </h1>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            opacity: 0.85,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          {badgeRegla}
        </span>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={copiarResumen}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #0ea5e9",
              background: "#0ea5e9",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Copiar resumen
          </button>
          <button
            onClick={exportarCSV}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #10b981",
              background: "#10b981",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Exportar CSV (Excel)
          </button>
          <button
            onClick={restablecer}
            title="Limpia los datos numéricos del expediente"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "#fff",
              color: "#ef4444",
              cursor: "pointer",
            }}
          >
            Restablecer
          </button>
        </div>
      </div>

      {/* Formulario principal */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            Inicio (DD/MM/AAAA)
          </label>
          <input
            value={inicio}
            onChange={(e) => setInicio(autoSlash(e.target.value))}
            placeholder="DD/MM/AAAA"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${
                inicio.length === 0 || inicioValido ? "#d1d5db" : "#ef4444"
              }`,
              background: "white",
            }}
            inputMode="numeric"
            pattern="\d{2}/\d{2}/\d{4}"
            aria-label="Fecha de inicio en formato DD/MM/AAAA"
            title="Fecha de inicio en formato DD/MM/AAAA"
          />
        </div>

        {/* Encadenado */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            Encadenado
          </label>
          <select
            value={encadenado}
            onChange={(e) => setEncadenado(e.target.value as EncadenadoMode)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
            }}
          >
            <option value="dia_siguiente">Día siguiente (oficial)</option>
            <option value="mismo_dia">Mismo día (criterio doctrinal)</option>
          </select>
        </div>

        {/* Vista de mínimos */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            Vista de mínimos (comparativa)
          </label>
          <select
            value={vistaMinimos}
            onChange={(e) => setVistaMinimos(e.target.value as any)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
            }}
          >
            <option value="oficial">Oficial (exclusiva)</option>
            <option value="doctrinal">Doctrinal (inclusiva)</option>
          </select>
        </div>

        {/* Régimen (informativo) */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            Régimen del expediente
          </label>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid #e5e7eb",
                background: "#f3f4f6",
              }}
              title="Régimen aplicado al expediente"
            >
              aplicado: <b>{regimenAplicado}</b>
            </span>
            <span
              title="Sugerencia automática a partir de las causas"
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid #e5e7eb",
                background: "#eef2ff",
                color: "#3730a3",
              }}
            >
              sugerido por causas: <b>{regimenSugeridoPorCausas}</b>
            </span>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="regimen"
                checked={regimenGlobal === "1/2"}
                onChange={() => setRegimenGlobal("1/2")}
              />{" "}
              1/2
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="regimen"
                checked={regimenGlobal === "2/3"}
                onChange={() => setRegimenGlobal("2/3")}
              />{" "}
              2/3
            </label>
          </div>
        </div>
      </div>

      {/* Causas */}
      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: 0 }}>Causas</h3>
        <label
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 12,
            color: "#374151",
          }}
        >
          <input
            type="checkbox"
            checked={ordenarGravosaPrimero}
            onChange={() => setOrdenarGravosaPrimero((v) => !v)}
          />
          Ordenar automáticamente (más gravosa primero)
        </label>
        {!ordenarGravosaPrimero ? (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Usa las flechas de cada fila para ajustar el orden manual.
          </div>
        ) : null}
        <button
          onClick={handleAgregarCausa}
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          + Agregar causa
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "80px 80px 80px 120px 150px 140px 120px",
            gap: 8,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280" }}>Años</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Meses</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Días</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Régimen</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Abono por causa</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Nombre (opcional)
          </div>
          <div></div>

          {causasOrdenadas.map((c, idx) => (
            <React.Fragment key={c.id}>
              <input
                type="number"
                value={c.anios}
                onChange={(e) =>
                  handleChangeCausa(c.id, "anios", Number(e.target.value))
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
                aria-label="Años de la causa"
              />
              <input
                type="number"
                value={c.meses}
                onChange={(e) =>
                  handleChangeCausa(c.id, "meses", Number(e.target.value))
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
                aria-label="Meses de la causa"
              />
              <input
                type="number"
                value={c.dias}
                onChange={(e) =>
                  handleChangeCausa(c.id, "dias", Number(e.target.value))
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
                aria-label="Días de la causa"
              />
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name={`reg_${c.id}`}
                    checked={c.regimen === "1/2"}
                    onChange={() => handleChangeCausa(c.id, "regimen", "1/2")}
                  />{" "}
                  1/2
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name={`reg_${c.id}`}
                    checked={c.regimen === "2/3"}
                    onChange={() => handleChangeCausa(c.id, "regimen", "2/3")}
                  />{" "}
                  2/3
                </label>
              </div>
              <input
                type="number"
                value={c.abonoCausa}
                onChange={(e) =>
                  handleChangeCausa(
                    c.id,
                    "abonoCausa",
                    Math.max(0, Number(e.target.value))
                  )
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
                aria-label="Abono por causa"
              />
              <input
                value={c.nombre || ""}
                onChange={(e) => handleChangeCausa(c.id, "nombre", e.target.value)}
                placeholder="(opcional)"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
                aria-label="Nombre de la causa"
              />
              <div style={{ display: "flex", gap: 4 }}>
                {!ordenarGravosaPrimero ? (
                  <>
                    <button
                      type="button"
                      onClick={() => moveCausa(c.id, -1)}
                      disabled={idx === 0}
                      title="Mover causa hacia arriba"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        cursor: idx === 0 ? "not-allowed" : "pointer",
                      }}
                      aria-label="Mover causa hacia arriba"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCausa(c.id, 1)}
                      disabled={idx === causasOrdenadas.length - 1}
                      title="Mover causa hacia abajo"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        cursor:
                          idx === causasOrdenadas.length - 1
                            ? "not-allowed"
                            : "pointer",
                      }}
                      aria-label="Mover causa hacia abajo"
                    >
                      ↓
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemoveCausa(c.id)}
                  title="Eliminar causa"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                  aria-label="Eliminar causa"
                >
                  🗑️
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* RESULTADOS */}
      <div
        className="print-block"
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {/* TO */}
        <div
          style={{
            border: "1px solid #f59e0b",
            background: "#fff7ed",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div style={{ fontSize: 12, color: "#b45309" }}>Término Original</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chip(`Brutos: ${resultados._debug?.diasBrutosTotales ?? "—"}`)}
              {chip(
                `Base efectiva: ${resultados._debug?.diasConAbonosTermino ?? "—"}`
              )}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {resultados.terminoOriginal || "—"}
          </div>
        </div>

        {/* TM */}
        <div
          style={{
            border: "1px solid #3b82f6",
            background: "#eff6ff",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
          title="TM automático según base efectiva y régimen; se puede ajustar ±1 día (presentación)"
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
          >
            <div style={{ fontSize: 12, color: "#1d4ed8" }}>TM (automático)</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {chip((() => {
                const ini = parseDMYtoUTC(inicio);
                const tmD = parseDMYtoUTC(tmDisplay);
                const val = ini && tmD ? diffDaysInclusiveUTC(ini, tmD) : "—";
                return `Tramo Inicio→TM: ${val} días`;
              })())}
              {tmAjuste !== 0 ? chip(`ajuste ${tmAjuste > 0 ? "+" : ""}${tmAjuste} día`) : null}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {resultados.tm || "—"}
          </div>
        </div>

        {/* TMBI */}
        <div
          style={{
            border: "1px solid #8b5cf6",
            background: "#f5f3ff",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
          title="TMBI automático como TM − 12 meses (respeta fin de mes)"
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
          >
            <div style={{ fontSize: 12, color: "#6d28d9" }}>TMBI (automático)</div>
            <div>{metricas ? chip(`Tramo Inicio→TMBI: ${metricas.L} días`) : null}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {resultados.tmbi || "—"}
          </div>
        </div>

        {/* CET */}
        <div
          style={{
            border: "1px solid #06b6d4",
            background: "#ecfeff",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
          title="CET se calcula automáticamente desde Inicio y TMBI; se puede ajustar ±1 día (presentación)"
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
          >
            <div style={{ fontSize: 12, color: "#0e7490" }}>TM CET (automático)</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {metricas ? chip(`Días CET: ${metricas.diasCET}`) : null}
              {cetAjuste !== 0 ? chip(`ajuste ${cetAjuste > 0 ? "+" : ""}${cetAjuste} día`) : null}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {resultados.tmCet || "—"}
          </div>
        </div>
      </div>

      {/* Avisos suaves de consistencia */}
      {warnings.length ? (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px dashed #f59e0b",
            borderRadius: 8,
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
          }}
        >
          {warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      ) : null}

      {/* === ¿Cómo se calculó? — PLEGABLE === */}
      <details
        id="manual-calculo"
        style={{ marginTop: 12 }}
        open={manualCalculoOpen}
        onToggle={(e) =>
          setManualCalculoOpen((e.target as HTMLDetailsElement).open)
        }
        aria-labelledby="manual-calculo-summary"
      >
        <summary
          id="manual-calculo-summary"
          style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}
          aria-controls="manual-calculo-content"
          aria-expanded={manualCalculoOpen}
        >
          ¿Cómo se calculó?
        </summary>
        <div
          id="manual-calculo-content"
          style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}
        >
          {manualCalculoInfo.listo ? (
            <>
              <button
                onClick={() =>
                  copiarTexto(
                    manualCalculoInfo.copy,
                    "Cálculo escrito copiado."
                  )
                }
                style={{
                  marginBottom: 12,
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1px solid #0ea5e9",
                  background: "#0ea5e9",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Copiar cálculo escrito
              </button>
              <ol style={{ marginLeft: 18, paddingLeft: 4 }}>
                {manualCalculoInfo.pasos.map((paso, idx) => (
                  <React.Fragment key={idx}>{paso}</React.Fragment>
                ))}
              </ol>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {manualCalculoInfo.mensaje}
            </div>
          )}
        </div>
      </details>

      {/* === Detalle del cómputo — PLEGABLE === */}
      <details
        id="detalle-calculo"
        style={{ marginTop: 12 }}
        open={detalleCalculoOpen}
        onToggle={(e) =>
          setDetalleCalculoOpen((e.target as HTMLDetailsElement).open)
        }
        aria-labelledby="detalle-calculo-summary"
      >
        <summary
          id="detalle-calculo-summary"
          style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}
          aria-controls="detalle-calculo-content"
          aria-expanded={detalleCalculoOpen}
        >
          Detalle del cómputo
        </summary>
        <div
          id="detalle-calculo-content"
          style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.6 }}
        >
          {detalleCalculoInfo.listo ? (
            <>
              <button
                onClick={() =>
                  copiarTexto(
                    detalleCalculoInfo.copy,
                    "Detalle copiado al portapapeles."
                  )
                }
                style={{
                  marginBottom: 12,
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Copiar cálculo escrito
              </button>
              <div style={{ display: "grid", gap: 12 }}>
                {detalleCalculoInfo.bloques.map((bloque, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        fontSize: 14,
                      }}
                    >
                      {bloque.titulo}
                    </div>
                    <dl
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(160px, 1fr) 2fr",
                        gap: 6,
                        margin: 0,
                      }}
                    >
                      {bloque.filas.map((fila, j) => (
                        <React.Fragment key={j}>
                          <dt style={{ fontWeight: 500, color: "#4b5563" }}>
                            {fila.etiqueta}
                          </dt>
                          <dd style={{ margin: 0 }}>{fila.valor}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {detalleCalculoInfo.copy}
            </div>
          )}
        </div>
      </details>

      {/* === Definiciones y conceptos — PLEGABLE === */}
      <details
        id="definiciones"
        style={{ marginTop: 16 }}
        open={definicionesOpen}
        onToggle={(e) =>
          setDefinicionesOpen((e.target as HTMLDetailsElement).open)
        }
      >
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Definiciones y conceptos a considerar
        </summary>

        <div style={{ marginTop: 8, lineHeight: 1.6, fontSize: 14 }}>
          <p>
            <b>Inicio:</b> Fecha desde donde se computa el expediente (formato <b>DD/MM/AAAA</b>). Todas las
            operaciones se realizan en <b>UTC</b> y con <b>días inclusivos</b>.
          </p>
          <p>
            <b>Encadenado:</b> Regla que determina cuándo inicia cada causa respecto del término de la anterior.
            <ul>
              <li>
                <b>Oficial (día siguiente):</b> La siguiente causa comienza el día siguiente al término de la previa.
              </li>
              <li>
                <b>Doctrinal (mismo día):</b> La siguiente causa inicia el mismo día del término de la previa (referencia comparativa).
              </li>
            </ul>
          </p>
          <p>
            <b>Suma Bruta de Causas:</b> Total de duración de todas las causas encadenadas, antes de considerar abonos.
            Respeta <i>fin de mes</i> al sumar años/meses y utiliza <i>días inclusivos</i>.
          </p>
          <p>
            <b>Abonos por Causa:</b> Días descontados a la duración de una causa específica. Modifican el encadenado y el cómputo.
          </p>
          <p>
            <b>Abono Global del Expediente:</b> Descuento total aplicado después de considerar los abonos por causa.
            Reduce el <b>Término Original (TO)</b> y la <b>base de mínimos</b>.
          </p>
          <p>
            <b>Base Efectiva (días):</b> Total resultante tras aplicar abonos.
            <br />
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                padding: "4px 8px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f9fafb",
                fontSize: 13,
              }}
            >
              Base Efectiva = <b>(Tras Abonos por Causa)</b> − <b>(Abono Global)</b>
            </span>
          </p>
          <p>
            <b>Término Original (TO):</b> <i>Inicio + (Base Efectiva − 1)</i>. No se agrega “+1” extra al final.
          </p>
          <p>
            <b>Tiempo Mínimo (TM):</b> Fecha en que se cumple el mínimo legal sobre la <b>base efectiva</b>, según régimen:
            <ul>
              <li>
                <b>1/2:</b> Se cumple la mitad.
              </li>
              <li>
                <b>2/3:</b> Se cumplen dos tercios.
              </li>
            </ul>
            La <b>Vista de Mínimos</b> define si el día 1 corre desde el día siguiente (Oficial, exclusiva)
            o desde el mismo día (Doctrinal, inclusiva).
          </p>
          <p>
            <b>TMBI:</b> Fecha <i>TM − 12 meses</i>, respetando el fin de mes.
          </p>
          <p>
            <b>TM CET:</b> <b>2/3 del tramo inclusivo</b> entre <b>Inicio</b> y <b>TMBI</b>.
            Vista Oficial: se muestra 1 día antes; Vista Doctrinal: llegada inclusiva.
          </p>
          <p>
            <b>Ajustes Finos (±1 día):</b> Desplazan solo la <b>fecha mostrada</b> de TM/CET. No cambian la base efectiva.
          </p>
        </div>
      </details>

      {/* === Herramienta auxiliar: Abonar a Fecha — PLEGABLE === */}
      <details
        style={{ marginTop: 16 }}
        open={abonarOpen}
        onToggle={(e) => setAbonarOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Herramienta auxiliar: Abonar a Fecha (tipo Excel)
        </summary>
        <div
          style={{
            marginTop: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Replica tu hoja Excel “Abonar a Fecha”: resta <b>Años/Meses/Días</b> a una fecha de término,
            respetando fin de mes y con días inclusivos. No altera el cómputo base.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Fecha Término (DD/MM/AAAA)
              </label>
              <input
                value={abonarFechaTermino}
                onChange={(e) => setAbonarFechaTermino(autoSlash(e.target.value))}
                placeholder="DD/MM/AAAA"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
                inputMode="numeric"
                aria-label="Fecha término para aplicar abonos Y/M/D"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Años a restar
              </label>
              <input
                type="number"
                value={abonarAnios}
                onChange={(e) => setAbonarAnios(Math.max(0, Number(e.target.value)))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Meses a restar
              </label>
              <input
                type="number"
                value={abonarMeses}
                onChange={(e) => setAbonarMeses(Math.max(0, Number(e.target.value)))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Días a restar
              </label>
              <input
                type="number"
                value={abonarDias}
                onChange={(e) => setAbonarDias(Math.max(0, Number(e.target.value)))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Resultado</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
              {resultadoAbonarFecha || "—"}
            </div>
          </div>
        </div>
      </details>

      {/* Opciones avanzadas */}
      <details id="opciones-avanzadas" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Opciones avanzadas
        </summary>

        {/* (1) ABONOS GLOBALES */}
        <div
          style={{
            marginTop: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#f9fafb",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Abonos que afectan mínimos (global)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#374151",
              }}
            >
              <input
                type="checkbox"
                checked={abonoMinimosGlobal}
                onChange={(e) => setAbonoMinimosGlobal(e.target.checked)}
              />
              Aplicar estos abonos al cálculo de TM/TMBI/CET (residual oficial)
            </label>
            <input
              type="number"
              value={abonosTotalesExpediente}
              onChange={(e) =>
                setAbonosTotalesExpediente(Math.max(0, Number(e.target.value)))
              }
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
              }}
              aria-label="Abonos globales del expediente"
            />
            <label
              style={{
                display: "grid",
                gap: 4,
                fontSize: 12,
                color: "#374151",
              }}
            >
              Criterio de redondeo (mínimos)
              <select
                value={roundingMode}
                onChange={(e) =>
                  setRoundingMode(e.target.value as RoundingMode)
                }
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="residual">Residual (oficial)</option>
                <option value="truncado">Truncado (solo enteros)</option>
                <option value="matematico">Matemático (≥0,5 sube)</option>
              </select>
            </label>
            <div style={{ fontSize: 12, color: "#4b5563" }}>
              Los abonos globales pueden <b>mover el TO</b> y la base de
              mínimos. Si desactivas la casilla, el valor se guarda como
              referencia, pero no se resta a TM/TMBI/CET.
            </div>
          </div>
        </div>

        {/* (2) DISTRIBUCIÓN POR CAUSA + TO OBJETIVO */}
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Distribución de abonos por causa y TO objetivo (opcional)
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <div style={{ gridColumn: "span 3" }}>
              {chip(`Total abonos (por causa + global): ${totalAbonosTodos}`)}
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 6,
                }}
              >
                Fecha esperable de término (TO objetivo)
              </label>
              <input
                value={toObjetivo}
                onChange={(e) => setToObjetivo(autoSlash(e.target.value))}
                placeholder="DD/MM/AAAA"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
                inputMode="numeric"
                aria-label="TO objetivo para sugerir distribución"
              />
            </div>
          </div>

          {/* Botones de distribución */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={sugerirDistribucion}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #0ea5e9",
                background: "#0ea5e9",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Sugerir distribución
            </button>
            <button
              onClick={aplicarSugerencia}
              disabled={!sugeridos}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #16a34a",
                background: sugeridos ? "#16a34a" : "#9ca3af",
                color: "#fff",
                cursor: sugeridos ? "pointer" : "not-allowed",
              }}
            >
              Aplicar distribución sugerida
            </button>
          </div>

          {/* Mensaje de sugerencia */}
          {sugerenciaInfo ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border:
                  sugerenciaInfo.tipo === "ok"
                    ? "1px solid #16a34a"
                    : sugerenciaInfo.tipo === "warn"
                    ? "1px solid #f59e0b"
                    : "1px solid #ef4444",
                background: "#fff",
                color: "#111827",
                fontSize: 12,
              }}
            >
              {sugerenciaInfo.mensaje}
            </div>
          ) : null}

          {/* Tabla de sugeridos + previa */}
          {sugeridos ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Distribución propuesta (abonos por causa)
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px,1fr) 120px 120px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>Causa</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Actual</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Sugerido</div>
                {causasOrdenadas.map((c) => {
                  const sug =
                    sugeridos.find((s) => s.id === c.id)?.nuevoAbono ??
                    c.abonoCausa;
                  return (
                    <React.Fragment key={c.id}>
                      <div>{c.nombre || c.id}</div>
                      <div>{c.abonoCausa}</div>
                      <div>{sug}</div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Previa de resultados con sugeridos */}
              {simulados ? (
                <div
                  className="print-block"
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #f59e0b",
                      background: "#fff7ed",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#b45309" }}>
                      TO (previa)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                      {simulados.terminoOriginal || "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #3b82f6",
                      background: "#eff6ff",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#1d4ed8" }}>
                      TM (automático)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                      {simulados.tm || "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #8b5cf6",
                      background: "#f5f3ff",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#6d28d9" }}>
                      TMBI (automático)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                      {simulados.tmbi || "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #06b6d4",
                      background: "#ecfeff",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#0e7490" }}>
                      TM CET (auto, previa)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                      {simulados.tmCet || "—"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* (3) AJUSTES FINOS + (4) INGRESOS MANUALES */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* Ajustes finos */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Ajustes finos (presentación) — poco frecuente
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div>
                <label
                  style={{ display: "block", fontSize: 12, color: "#6b7280" }}
                >
                  Ajuste fino TM (±1 día)
                </label>
                <select
                  value={tmAjuste}
                  onChange={(e) =>
                    setTmAjuste(Number(e.target.value) as -1 | 0 | 1)
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value={-1}>−1</option>
                  <option value={0}>0</option>
                  <option value={1}>+1</option>
                </select>
              </div>
              <div>
                <label
                  style={{ display: "block", fontSize: 12, color: "#6b7280" }}
                >
                  Ajuste fino CET (±1 día)
                </label>
                <select
                  value={cetAjuste}
                  onChange={(e) =>
                    setCetAjuste(Number(e.target.value) as -1 | 0 | 1)
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value={-1}>−1</option>
                  <option value={0}>0</option>
                  <option value={1}>+1</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#4b5563" }}>
              Desplaza la <b>fecha mostrada</b> (no la base de cálculo) para
              cuadrar expedientes con corrimientos mínimos.
            </div>
          </div>

          {/* Ingresos manuales */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Ingresos manuales (opcional)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <label
                  style={{ display: "block", fontSize: 12, color: "#6b7280" }}
                >
                  TM (manual)
                </label>
                <input
                  value={tmIngresado}
                  onChange={(e) => setTmIngresado(autoSlash(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                  inputMode="numeric"
                  aria-label="TM ingresado por el funcionario/a"
                />
              </div>

              <div>
                <label
                  style={{ display: "block", fontSize: 12, color: "#6b7280" }}
                >
                  TMBI (manual)
                </label>
                <input
                  value={tmbiIngresado}
                  onChange={(e) => setTmbiIngresado(autoSlash(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                  inputMode="numeric"
                  aria-label="TMBI ingresado por el funcionario/a"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Módulo de distribución (clásico) visible dentro de avanzadas */}
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Módulo de distribución (clásico) — opcional
          </div>
          <UIErrorBoundary>
            {React.createElement(AbonosDistribucion as any, {
              causas: Array.isArray(causasOrdenadas) ? causasOrdenadas : [],
              inicio,
              encadenado,
              onAbonoChange: (id: string, nuevoAbono: number) =>
                setCausas((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? { ...c, abonoCausa: Math.max(0, Number(nuevoAbono)) }
                      : c
                  )
                ),
            })}
          </UIErrorBoundary>
        </div>

        {/* Respaldo (JSON/CSV) */}
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Respaldo del expediente (.json/.csv)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={exportarJSON}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Exportar JSON
            </button>
            <button
              onClick={importarJSON}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Importar JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={onImportFile}
              style={{ display: "none" }}
            />
            <button
              onClick={exportarCSV}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #10b981",
                background: "#10b981",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Exportar CSV (Excel)
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
            El CSV usa separador <b>;</b> (compatible con Excel en ES-CL).
          </div>
        </div>
      </details>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirm.open}
        title="Eliminar causa"
        message="Esta acción quitará la causa del expediente. ¿Deseas continuar?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmRemove}
        onCancel={closeConfirm}
      />

      {/* Pie: versión y autor */}
      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "#6b7280",
          textAlign: "center",
        }}
      >
        v1.0 · Creado por <b>Teniente Luis Ascencio Oberg</b>
      </div>

      {/* Botón flotante: Comentarios */}
      <FeedbackSlideOver gasUrl={GAS_URL} />

      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          maxWidth: 320,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        {toast ? (
          <div
            role="status"
            style={{
              background: "#111827",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 12,
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
              fontSize: 13,
            }}
          >
            {toast.message}
          </div>
        ) : (
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(1px, 1px, 1px, 1px)",
            }}
          ></span>
        )}
      </div>
    </div>
  );
}