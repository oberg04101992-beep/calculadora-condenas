// src/CalculadoraCondenas.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AbonosDistribucion from "./components/AbonosDistribucion";
import DisclaimerModal from "./components/DisclaimerModal";
import FeedbackSlideOver from "./components/FeedbackSlideOver";
import ConfirmDialog from "./components/ConfirmDialog";

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
type Regimen = "1/2" | "2/3";
type EncadenadoMode = "dia_siguiente" | "mismo_dia";
type Causa = {
  id: string;
  anios: number;
  meses: number;
  dias: number;
  abonoCausa: number;
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
const DAY = 24 * 60 * 60 * 1000;

/* ===== Utilidades de fecha (UTC) ===== */
function fmtDMY(d?: Date | null) {
  if (!d) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}
function parseDMYtoUTC(s?: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  return isNaN(dt.getTime()) ? null : dt;
}
const addDaysUTC = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Suma/resta años/meses respetando fin de mes (normativa) */
function addYearsMonthsUTC(d: Date, years: number, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const base = new Date(Date.UTC(y + years, m + months, 1));
  const lastDay = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const useDay = Math.min(d.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), useDay, 0, 0, 0)
  );
}

/** D?as inclusivos [a ? b] */
function diffDaysInclusiveUTC(a: Date, b: Date): number {
  const A = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const B = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((B - A) / DAY) + 1;
}

/* ===== Encadenado de causas (TO oficial) ===== */
function finDeCausa(d: Date, anios: number, meses: number, dias: number) {
  const y = anios || 0;
  const m = meses || 0;
  const dd = dias || 0;
  const base = addYearsMonthsUTC(d, y, m);

  if (dd <= 0) return base;

  // Regla oficial: si hay años/meses y además días, los días se suman completos.
  // Si la causa es solo en días, se mantiene conteo inclusivo (days - 1).
  if (y === 0 && m === 0) return addDaysUTC(base, dd - 1);
  return addDaysUTC(base, dd);
}
function encadenarExpediente(
  causas: Causa[],
  inicioDMY: string,
  encadenado: EncadenadoMode
) {
  const ini = parseDMYtoUTC(inicioDMY)!;
  let startBruto = ini;
  let startAbono = ini;

  let finConAbonos = ini;
  let finBruto = ini;

  let totalBrutos = 0;
  let totalConAbonos = 0;

  for (const c of causas) {
    // tramo bruto
    const endBruto = finDeCausa(
      startBruto,
      c.anios || 0,
      c.meses || 0,
      c.dias || 0
    );
    const durBruto = diffDaysInclusiveUTC(startBruto, endBruto);

    // tramo con abonos por causa (no aplica global aquí)
    const ab = Math.max(0, c.abonoCausa || 0);
    const durConAbonos = Math.max(0, durBruto - ab);
    const endConAbonos =
      durConAbonos > 0
        ? addDaysUTC(startAbono, durConAbonos - 1)
        : addDaysUTC(startAbono, -1);

    totalBrutos += durBruto;
    totalConAbonos += durConAbonos;

    // siguiente inicio
    if (encadenado === "dia_siguiente") {
      startBruto = addDaysUTC(endBruto, 1);
      startAbono = addDaysUTC(endConAbonos, 1);
    } else {
      startBruto = endBruto;
      startAbono = endConAbonos;
    }

    finBruto = endBruto;
    finConAbonos = endConAbonos;
  }
  return { finConAbonos, finBruto, totalBrutos, totalConAbonos };
}

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

type ManualTone = {
  border: string;
  background: string;
  title: string;
};

const manualCardTones: Record<"to" | "tm" | "tmbi" | "cet", ManualTone> = {
  to: { border: "#f59e0b", background: "#fff7ed", title: "#b45309" },
  tm: { border: "#3b82f6", background: "#eff6ff", title: "#1d4ed8" },
  tmbi: { border: "#8b5cf6", background: "#f5f3ff", title: "#6d28d9" },
  cet: { border: "#06b6d4", background: "#ecfeff", title: "#0e7490" },
};

function formatUnit(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatCondenaManual(anios: number, meses: number, dias: number) {
  return [
    formatUnit(anios, "año", "años"),
    formatUnit(meses, "mes", "meses"),
    formatUnit(dias, "día", "días"),
  ].join(" · ");
}

function formatYearsMonthsOperacion(anios: number, meses: number) {
  const partes: string[] = [];
  if (anios > 0) partes.push(formatUnit(anios, "año", "años"));
  if (meses > 0) partes.push(formatUnit(meses, "mes", "meses"));
  return partes.join(" y ");
}

function formatSignedDays(value: number) {
  const abs = Math.abs(value);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs} ${
    abs === 1 ? "día" : "días"
  }`;
}

function ManualCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: ManualTone;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderLeft: `3px solid ${tone.border}`,
        borderRadius: 8,
        background: "#fff",
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: tone.title,
          letterSpacing: 0.2,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ display: "grid", gap: 2 }}>{children}</div>
    </section>
  );
}

function ManualRow({
  label,
  value,
  strong = false,
  first = false,
  result = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  first?: boolean;
  result?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 1fr max-content",
        gap: 6,
        alignItems: "center",
        padding: result ? "6px 0 0" : "4px 0",
        borderTop: first ? "none" : result ? "1px solid #d1d5db" : "1px dotted #e5e7eb",
        fontFamily:
          '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: result ? 800 : 600,
          color: result ? "#0f172a" : "#475569",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          borderBottom: result ? "1px solid transparent" : "1px dotted #cbd5e1",
          height: 1,
          transform: "translateY(-1px)",
        }}
      />
      <div
        style={{
          fontSize: 12,
          fontWeight: result ? 800 : strong ? 700 : 600,
          color: "#111827",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}
/* ===== Utilidades varias ===== */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/* =================== Componente =================== */
export default function CalculadoraCondenas() {
  /* Formulario base */
  const [inicio, setInicio] = useState("");
  const encadenado: EncadenadoMode = "dia_siguiente";
  const [regimenGlobal, setRegimenGlobal] = useState<Regimen>("2/3");
  const vistaMinimos: "oficial" = "oficial";

  /* Causas */
  const [causas, setCausas] = useState<Causa[]>([]);
  const [ordenarGravosaPrimero, setOrdenarGravosaPrimero] = useState(true);

  /* Opciones avanzadas */
  const [abonosTotalesExpediente, setAbonosTotalesExpediente] = useState(0);

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

  /* Confirmaci?n eliminar causa */
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

  /* Recuerdo de plegado */
  const [ejemploOpen, setEjemploOpen] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("ejemploOpen") === "1";
    } catch {
      return false;
    }
  });
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
      localStorage.setItem("ejemploOpen", ejemploOpen ? "1" : "0");
    } catch {}
  }, [ejemploOpen]);
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
      if (typeof s.inicio === "string") setInicio(s.inicio);
      if (s?.regimenGlobal) setRegimenGlobal(s.regimenGlobal);
      if (Array.isArray(s?.causas)) setCausas(s.causas);
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
    if (regimenSugeridoPorCausas === "2/3") return "2/3";
    if (!regimenGlobal) return "2/3";
    return regimenGlobal;
  }, [regimenGlobal, regimenSugeridoPorCausas]);

  /* Orden visual de causas */
  const causasOrdenadas = useMemo(() => {
    const withLen = causas.map((c) => ({
      ...c,
      len: duracionCausaRealDias(c),
    }));
    if (!ordenarGravosaPrimero) return withLen;
    return [...withLen].sort((a, b) => b.len - a.len);
  }, [causas, ordenarGravosaPrimero]);

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
    const ini = parseDMYtoUTC(inicio);
    if (!ini || causasOrdenadas.length === 0)
      return null as null | ReturnType<typeof encadenarExpediente>;
    return encadenarExpediente(causasOrdenadas, inicio, encadenado);
  }, [inicio, causasOrdenadas, encadenado]);

  /* ===== Base normativa estricta =====
     Base efectiva = (suma causas con abonos por causa) ? abono global  */
  const baseEfectivaDias = useMemo(() => {
    if (!chainActual) return 0;
    return Math.max(
      0,
      (chainActual.totalConAbonos || 0) - (abonosTotalesExpediente || 0)
    );
  }, [chainActual, abonosTotalesExpediente]);

  /* TO normativo: Inicio + (Base efectiva ? 1) */
  const toNormativo = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    if (!ini || baseEfectivaDias <= 0) return "";
    return fmtDMY(addDaysUTC(ini, baseEfectivaDias - 1));
  }, [inicio, baseEfectivaDias]);

  /* TM/TMBI/CET automáticos (con override manual opcional en TM/TMBI) */
  const tmAuto = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    if (!ini || baseEfectivaDias <= 0) return "";
    const ratio = regimenAplicado === "1/2" ? 1 / 2 : 2 / 3;
    const diasTM = Math.floor(baseEfectivaDias * ratio);


    // Criterio oficial: conteo exclusivo (dia 1 = dia siguiente).
    let llegada = addDaysUTC(ini, Math.max(0, diasTM));
    if (llegada.getUTCDate() < ini.getUTCDate()) {
      llegada = addDaysUTC(llegada, -1);
    }
    return fmtDMY(llegada);
  }, [inicio, baseEfectivaDias, regimenAplicado]);

  const tmMostrado = useMemo(
    () => (tmIngresado ? tmIngresado : tmAuto),
    [tmIngresado, tmAuto]
  );

  // TMBI desde TM (manual o auto) - normativa: TM - 12 meses (con fin de mes)
  const tmbiAuto = useMemo(() => {
    const tmD = parseDMYtoUTC(tmMostrado || tmAuto);
    const ini = parseDMYtoUTC(inicio);
    if (!tmD || !ini) return "";
    const tmbi = addYearsMonthsUTC(tmD, -1, 0);
    const tmbiClampeado = tmbi.getTime() < ini.getTime() ? ini : tmbi;
    return fmtDMY(tmbiClampeado);
  }, [tmMostrado, tmAuto, inicio]);

  const tmbiMostrado = useMemo(
    () => (tmbiIngresado ? tmbiIngresado : tmbiAuto),
    [tmbiIngresado, tmbiAuto]
  );

  // CET automatico desde Inicio a TMBI con ajuste por cierre de tramo.
  const cetAuto = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    const tmbi = parseDMYtoUTC(tmbiMostrado);
    if (!ini || !tmbi) return "";
    const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
    const diasCET = Math.ceil(L * (2 / 3));
    let llegada = addDaysUTC(ini, Math.max(0, diasCET - 1));

    if (tmbi.getUTCDate() < ini.getUTCDate()) {
      llegada = addDaysUTC(llegada, -1);
    }
    return fmtDMY(llegada);
  }, [inicio, tmbiMostrado]);

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
    if (!ini || !tmbi) return null as null | { L: number; diasCET: number };
    const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
    const diasCET = Math.ceil(L * (2 / 3));
    return { L, diasCET };
  }, [inicio, tmbiMostrado]);

  /* Resultados para tarjetas */
  const resultados = useMemo<Resultados>(() => {
    return {
      terminoOriginal: toNormativo || "",
      tm: tmDisplay || "",
      tmbi: tmbiMostrado || "",
      tmCet: cetDisplay || "",
      _debug: chainActual
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

  function duracionCausaRealDias(c: Causa) {
    const ini = parseDMYtoUTC(inicio);
    if (!ini) return 0;
    const fin = finDeCausa(ini, c.anios || 0, c.meses || 0, c.dias || 0);
    return diffDaysInclusiveUTC(ini, fin);
  }

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
  const hayAbonosPorCausaYGlobal =
    totalAbonosPorCausa > 0 && totalAbonosGlobal > 0;

  const desgloseManualCausas = useMemo(() => {
    const ini = parseDMYtoUTC(inicio);
    if (!ini || causasOrdenadas.length === 0) return [];

    let startBruto = ini;
    let startUtil = ini;

    return causasOrdenadas.map((c, idx) => {
      const anios = Math.max(0, c.anios || 0);
      const meses = Math.max(0, c.meses || 0);
      const dias = Math.max(0, c.dias || 0);
      const abono = Math.max(0, c.abonoCausa || 0);

      const actualStartBruto = startBruto;
      const actualStartUtil = startUtil;
      const afterYM =
        anios > 0 || meses > 0
          ? addYearsMonthsUTC(actualStartBruto, anios, meses)
          : actualStartBruto;
      const endBruto = finDeCausa(actualStartBruto, anios, meses, dias);
      const durBruto = diffDaysInclusiveUTC(actualStartBruto, endBruto);
      const durUtil = Math.max(0, durBruto - abono);
      const endUtil =
        durUtil > 0
          ? addDaysUTC(actualStartUtil, durUtil - 1)
          : addDaysUTC(actualStartUtil, -1);

      if (encadenado === "dia_siguiente") {
        startBruto = addDaysUTC(endBruto, 1);
        startUtil = addDaysUTC(endUtil, 1);
      } else {
        startBruto = endBruto;
        startUtil = endUtil;
      }

      return {
        key: c.id,
        label: c.nombre?.trim() || `Causa ${idx + 1}`,
        condena: formatCondenaManual(anios, meses, dias),
        inicioBruto: fmtDMY(actualStartBruto),
        inicioUtil: fmtDMY(actualStartUtil),
        pasoYearsMonths:
          anios > 0 || meses > 0
            ? {
                label: formatYearsMonthsOperacion(anios, meses),
                fecha: fmtDMY(afterYM),
              }
            : null,
        pasoDias:
          dias > 0
            ? {
                label: formatUnit(dias, "día", "días"),
                fecha: fmtDMY(endBruto),
              }
            : null,
        finBruto: fmtDMY(endBruto),
        finUtil: durUtil > 0 ? fmtDMY(endUtil) : "Sin tramo",
        durBruto,
        durUtil,
        abono,
      };
    });
  }, [inicio, causasOrdenadas, encadenado]);

  /* Sugerencia simple a TO objetivo (opcional) */
  const [simulados, setSimulados] = useState<Resultados | null>(null);
  const mensajeFaltantesDistribucion = useMemo(() => {
    const faltantes: string[] = [];
    if (!parseDMYtoUTC(inicio)) faltantes.push("ingresar Inicio");
    if (causasOrdenadas.length === 0)
      faltantes.push("agregar al menos una causa");

    const toObjetivoTrim = (toObjetivo || "").trim();
    if (!toObjetivoTrim) {
      faltantes.push("ingresar TO objetivo");
    } else if (!parseDMYtoUTC(toObjetivoTrim)) {
      faltantes.push("corregir TO objetivo en formato DD/MM/AAAA");
    }

    return faltantes.length > 0
      ? `Para usar esta sección: ${faltantes.join(", ")}.`
      : "";
  }, [inicio, causasOrdenadas.length, toObjetivo]);

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
    const chain = encadenarExpediente(causasTemp, inicio, encadenado);
    const D_eff = Math.max(
      0,
      (chain.totalConAbonos || 0) - (abonosTotalesExpediente || 0)
    );
    const toPrev = D_eff > 0 ? fmtDMY(addDaysUTC(ini, D_eff - 1)) : "";


    const tmbi = parseDMYtoUTC(tmbiMostrado);
    const cet = (() => {
      if (!ini || !tmbi) return "";
      const L = Math.max(1, diffDaysInclusiveUTC(ini, tmbi));
      const diasCET = Math.ceil(L * (2 / 3));
      let fechaCET = addDaysUTC(ini, Math.max(0, diasCET - 1));
      if (tmbi.getUTCDate() < ini.getUTCDate()) {
        fechaCET = addDaysUTC(fechaCET, -1);
      }
      return fmtDMY(fechaCET);
    })();

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

  /* Copiar resumen */
  const copiarResumen = async () => {
    const encStr = "Oficial institucional (día siguiente)";
    const minStr = "Oficial institucional (exclusiva)";

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
      `Abonos: por causa ${totalAbonosPorCausa} · global ${totalAbonosGlobal} · total ${totalAbonosTodos}\n`;
    try {
      await navigator.clipboard.writeText(texto);
      alert("Resumen copiado al portapapeles.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Resumen copiado.");
    }
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
      esc("Oficial institucional (día siguiente)"),
    ].join(sep));
    lines.push([
      "Resumen",
      "Vista de mínimos",
      esc("Oficial institucional (exclusiva)"),
    ].join(sep));
    lines.push([
      "Resumen",
      "Días brutos totales",
      esc(resultados._debug?.diasBrutosTotales ?? "—"),
    ].join(sep));
    lines.push([
      "Resumen",
      "Base efectiva (días)",
      esc(resultados._debug?.diasConAbonosTermino ?? "—"),
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
        if (s.regimenGlobal) setRegimenGlobal(s.regimenGlobal);
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
    if (chainActual && chainActual.totalConAbonos - totalAbonosGlobal < 0) {
      res.push("La Base Efectiva quedó negativa (revisa abonos globales).");
    }
    return res;
  })();

  /* Etiqueta principal */
  const badgeRegla = "UTC - Minimos: Oficial institucional (exclusiva) - Modo: Normativa - Ajuste fino TM/CET +/-1 (opcional)";

  /* ====== Herramienta auxiliar: Abonar a Fecha (tipo Excel) ====== */
  const [abonarFechaTermino, setAbonarFechaTermino] = useState<string>("");
  const [abonarAnios, setAbonarAnios] = useState<number>(0);
  const [abonarMeses, setAbonarMeses] = useState<number>(0);
  const [abonarDias, setAbonarDias] = useState<number>(0);
  const abonarFechaTerminoDate = useMemo(
    () => parseDMYtoUTC(abonarFechaTermino),
    [abonarFechaTermino]
  );
  const mensajeAbonarFecha = useMemo(() => {
    const f = (abonarFechaTermino || "").trim();
    if (!f) {
      return "Para usar este modulo, ingresa Fecha Termino (DD/MM/AAAA).";
    }
    if (!abonarFechaTerminoDate) {
      return "Fecha Termino invalida. Usa el formato DD/MM/AAAA.";
    }
    return "";
  }, [abonarFechaTermino, abonarFechaTerminoDate]);
  const abonarSinDescuento =
    abonarAnios === 0 && abonarMeses === 0 && abonarDias === 0;

  const resultadoAbonarFecha = useMemo(() => {
    if (!abonarFechaTerminoDate) return "";
    // Resta Y/M con respeto a fin de mes y luego Dias
    const menosYM = addYearsMonthsUTC(
      abonarFechaTerminoDate,
      -Math.max(0, abonarAnios),
      -Math.max(0, abonarMeses)
    );
    const menosYMD = addDaysUTC(menosYM, -Math.max(0, abonarDias));
    return fmtDMY(menosYMD);
  }, [abonarFechaTerminoDate, abonarAnios, abonarMeses, abonarDias]);

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

        {/* Regimen (informativo) */}
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
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, color: "#4b5563" }}>
                Selección manual:
              </span>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="regimen"
                  checked={regimenAplicado === "1/2"}
                  disabled={regimenSugeridoPorCausas === "2/3"}
                  onChange={() => setRegimenGlobal("1/2")}
                />{" "}
                1/2
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="regimen"
                  checked={regimenAplicado === "2/3"}
                  onChange={() => setRegimenGlobal("2/3")}
                />{" "}
                2/3
              </label>
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
            </div>

            {regimenSugeridoPorCausas !== regimenAplicado ? (
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                Sugerido por causas: <b>{regimenSugeridoPorCausas}</b>.
              </div>
            ) : null}

            {regimenSugeridoPorCausas === "2/3" ? (
              <div
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  border: "1px solid #f59e0b",
                  background: "#fffbeb",
                  color: "#92400e",
                }}
              >
                Observación: por causas activas, el expediente exige régimen
                2/3.
              </div>
            ) : null}
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
            gridTemplateColumns: "80px 80px 80px 120px 150px 140px 40px",
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

          {causasOrdenadas.map((c) => (
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
              <button
                onClick={() => handleRemoveCausa(c.id)}
                title="Eliminar causa"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                aria-label="Eliminar causa"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M5 6l1 14h12l1-14" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
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
            <div key={i}>⬢ {w}</div>
          ))}
        </div>
      ) : null}

      {/* === Desglose manual referencial ? PLEGABLE === */}
      <details
        style={{ marginTop: 12 }}
        open={ejemploOpen}
        onToggle={(e) => setEjemploOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Desglose del cómputo
        </summary>
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
          {!inicio || causasOrdenadas.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Ingresa <b>Inicio</b> y al menos <b>una causa</b> para ver el desglose dinámico del cómputo.
            </div>
          ) : (
            <>
              {(() => {
                const N = chainActual?.totalBrutos ?? 0;
                const X = totalAbonosPorCausa;
                const M = chainActual?.totalConAbonos ?? 0;
                const Y = totalAbonosGlobal;
                const Z = Math.max(0, M - Y);
                const diasHastaTO = Z > 0 ? Z - 1 : 0;
                const ratioTM = regimenAplicado === "1/2" ? 1 / 2 : 2 / 3;
                const diasTMCalculados = Math.floor(Z * ratioTM);
                const tmBaseParaTmbi = tmMostrado || tmAuto || "—";
                const referenciasOperativas: string[] = [];

                if (tmIngresado) referenciasOperativas.push(`TM manual: ${tmIngresado}`);
                if (tmbiIngresado) referenciasOperativas.push(`TMBI manual: ${tmbiIngresado}`);
                if (tmAjuste !== 0) {
                  referenciasOperativas.push(`Ajuste visual TM: ${formatSignedDays(tmAjuste)}`);
                }
                if (cetAjuste !== 0) {
                  referenciasOperativas.push(`Ajuste visual TM CET: ${formatSignedDays(cetAjuste)}`);
                }

                return (
                  <div style={{ display: "grid", gap: 8 }}>
                    {referenciasOperativas.length ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                        }}
                      >
                        Referencia operativa: {referenciasOperativas.join(" · ")}
                      </div>
                    ) : null}

                    <div style={{ display: "grid", gap: 8 }}>
                      <ManualCard
                        title="TO — Término original"
                        tone={manualCardTones.to}
                      >
                        <ManualRow first label="Inicio" value={inicio} />

                        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                          {desgloseManualCausas.map((causa, idx) => (
                            <div
                              key={causa.key}
                              style={{
                                paddingTop: idx === 0 ? 0 : 6,
                                borderTop: idx === 0 ? "none" : "1px dashed #e5e7eb",
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>
                                {causa.label} · {causa.condena}
                              </div>
                              <div>
                                <ManualRow first label="Desde" value={causa.inicioBruto} />
                                {causa.pasoYearsMonths ? (
                                  <ManualRow
                                    label={`+ ${causa.pasoYearsMonths.label}`}
                                    value={causa.pasoYearsMonths.fecha}
                                  />
                                ) : null}
                                {causa.pasoDias ? (
                                  <ManualRow
                                    label={`+ ${causa.pasoDias.label}`}
                                    value={causa.pasoDias.fecha}
                                  />
                                ) : null}
                                {!causa.pasoYearsMonths && !causa.pasoDias ? (
                                  <ManualRow label="+ 0 días" value={causa.finBruto} />
                                ) : null}
                                <ManualRow label="Bruto" value={`${causa.durBruto} días`} />
                                {causa.abono > 0 ? (
                                  <ManualRow label="- abono" value={`${causa.abono} días`} />
                                ) : null}
                                <ManualRow
                                  label="Útil"
                                  value={`${causa.durUtil} días`}
                                  strong={causa.abono > 0}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 6 }}>
                          <ManualRow first label="Bruto total" value={`${N} días`} />
                          <ManualRow label="- abonos causa" value={`${X} días`} />
                          <ManualRow label="Base por causa" value={`${M} días`} />
                          <ManualRow label="- abono global" value={`${Y} días`} />
                          <ManualRow label="Base efectiva" value={`${Z} días`} strong />
                          <ManualRow label={`Inicio + ${diasHastaTO} días`} value={resultados.terminoOriginal || "—"} />
                          <ManualRow label="= TO" value={resultados.terminoOriginal || "—"} result />
                        </div>
                      </ManualCard>

                      <ManualCard
                        title="TM — Tiempo mínimo"
                        tone={manualCardTones.tm}
                      >
                        <ManualRow first label="Base efectiva" value={`${Z} días`} strong />
                        <ManualRow
                          label="Régimen"
                          value={regimenAplicado === "1/2" ? "1/2" : "2/3"}
                        />
                        <ManualRow
                          label={`${regimenAplicado} de ${Z}`}
                          value={`${diasTMCalculados} días`}
                        />
                        <ManualRow label="Inicio" value={inicio} />
                        <ManualRow label={`+ ${diasTMCalculados} días`} value={tmAuto || "—"} />
                        {tmIngresado ? (
                          <ManualRow
                            label="TM manual"
                            value={<b>{tmIngresado}</b>}
                          />
                        ) : null}
                        {tmAjuste !== 0 ? (
                          <ManualRow
                            label="Ajuste"
                            value={
                              <>
                                {formatSignedDays(tmAjuste)}{" → "}<b>{resultados.tm || "—"}</b>
                              </>
                            }
                            strong
                          />
                        ) : null}
                        <ManualRow label="= TM" value={resultados.tm || "—"} result />
                      </ManualCard>

                      <ManualCard
                        title="TMBI — Beneficio intrapenitenciario"
                        tone={manualCardTones.tmbi}
                      >
                        <ManualRow
                          first
                          label="TM base"
                          value={<b>{tmBaseParaTmbi}</b>}
                        />
                        <ManualRow label="- 12 meses" value={tmbiAuto || "—"} />
                        {tmbiIngresado ? (
                          <ManualRow
                            label="TMBI manual"
                            value={<b>{tmbiIngresado}</b>}
                          />
                        ) : null}
                        <ManualRow label="= TMBI" value={resultados.tmbi || "—"} result />
                      </ManualCard>

                      <ManualCard
                        title="TM CET — Control de ejecución"
                        tone={manualCardTones.cet}
                      >
                        <ManualRow first label="Inicio" value={inicio} />
                        <ManualRow
                          label="TMBI usado"
                          value={<b>{tmbiMostrado || "—"}</b>}
                        />
                        <ManualRow
                          label="Tramo Inicio-TMBI"
                          value={metricas ? `${metricas.L} días` : "—"}
                        />
                        <ManualRow
                          label={metricas ? `2/3 de ${metricas.L}` : "2/3 del tramo"}
                          value={metricas ? `${metricas.diasCET} días` : "—"}
                        />
                        <ManualRow
                          label={metricas ? `+ ${Math.max(0, metricas.diasCET - 1)} días` : "Operación"}
                          value={cetAuto || "—"}
                        />
                        {cetAjuste !== 0 ? (
                          <ManualRow
                            label="Ajuste"
                            value={
                              <>
                                {formatSignedDays(cetAjuste)}{" → "}<b>{resultados.tmCet || "—"}</b>
                              </>
                            }
                            strong
                          />
                        ) : null}
                        <ManualRow label="= TM CET" value={resultados.tmCet || "—"} result />
                      </ManualCard>
                    </div>

                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      Ajustes visuales: solo mueven la fecha mostrada; no cambian la base de días.
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </details>

      {/* === Definiciones y conceptos ? PLEGABLE === */}
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

        <div style={{ marginTop: 8, display: "grid", gap: 8, fontSize: 14 }}>
          {[
            ["Inicio", "Fecha desde la que comienza el cómputo del expediente."],
            ["Término original (TO)", "Fecha final de cumplimiento de la condena según el cómputo actual."],
            ["Tiempo mínimo (TM)", "Fecha en que se cumple el mínimo exigido según el régimen aplicado."],
            ["TMBI", "Fecha de referencia para beneficio intrapenitenciario, obtenida desde el TM."],
            ["TM CET", "Fecha de control de ejecución que la calculadora muestra a partir del tramo entre Inicio y TMBI."],
            ["Base efectiva", "Total de días que realmente se usan para calcular TO y mínimos, después de los abonos."],
            ["Abono", "Descuento de días que reduce el tiempo a computar. Puede cargarse por causa o como abono global."],
            ["Régimen 1/2 y 2/3", "Porcentaje de la base efectiva que se usa para calcular el TM del expediente."],
          ].map(([titulo, detalle]) => (
            <div
              key={titulo}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                background: "#fafafa",
                padding: "8px 10px",
              }}
            >
              <b>{titulo}:</b> {detalle}
            </div>
          ))}

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#f8fafc",
              padding: "8px 10px",
              fontFamily:
                '"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
            }}
          >
            Base efectiva = (días útiles por causa) − (abono global)
          </div>
        </div>
      </details>

      {/* === Herramienta auxiliar: Abonar a Fecha ? PLEGABLE === */}
      <details
        style={{ marginTop: 16 }}
        open={abonarOpen}
        onToggle={(e) => setAbonarOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Abonar a fecha (apoyo operativo)
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
            Módulo de apoyo institucional: calcula una nueva fecha al descontar
            <b> Años, Meses y Días </b>
            desde una Fecha Término. Este bloque es informativo y no modifica
            el cálculo principal del expediente.
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

          {mensajeAbonarFecha ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#374151",
                fontSize: 12,
              }}
            >
              {mensajeAbonarFecha}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Fecha resultante (descuento aplicado)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
              {resultadoAbonarFecha || "-"}
            </div>
            {abonarFechaTerminoDate ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#4b5563" }}>
                Base: {abonarFechaTermino || "-"} | Descuento: {abonarAnios}a{" "}
                {abonarMeses}m {abonarDias}d
                {abonarSinDescuento
                  ? " (sin descuento, mantiene fecha base)"
                  : ""}
              </div>
            ) : null}
          </div>
        </div>
      </details>

      {/* Opciones avanzadas */}
      <details id="opciones-avanzadas" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
          Opciones complementarias
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
            Abonos totales del expediente (global)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
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
            <div style={{ fontSize: 12, color: "#4b5563" }}>
              Los abonos globales <b>mueven el TO</b> y ajustan la base de
              mínimos (TM/TMBI/CET), conforme a la normativa.
            </div>
          </div>
        </div>

        {/* (2) DISTRIBUCI?N POR CAUSA + TO OBJETIVO */}
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
            Propuesta de distribución de abonos por causa y TO objetivo
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
            Uso institucional: esta sección sugiere una distribución de
            referencia para análisis operativo. No altera por sí sola el
            cálculo base ni los abonos por causa.
          </div>
          <div
            style={{
              marginBottom: 8,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              fontSize: 12,
            }}
          >
            Esta distribución es solo referencial y no modifica automáticamente
            los abonos por causa.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <div style={{ gridColumn: "span 3" }}>
              {chip(`Total abonos acumulados (causa + global): ${totalAbonosTodos}`)}
            </div>
            <div
              style={{
                gridColumn: "span 3",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Resumen de descuentos que inciden en la base efectiva
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#111827" }}>
                Abonos por causa: <b>{totalAbonosPorCausa}</b> días · Abono
                global: <b>{totalAbonosGlobal}</b> días · Total:{" "}
                <b>{totalAbonosTodos}</b> días · Base efectiva actual:{" "}
                <b>{resultados._debug?.diasConAbonosTermino ?? "—"}</b> días
              </div>
            </div>
            {hayAbonosPorCausaYGlobal ? (
              <div
                style={{
                  gridColumn: "span 3",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #f59e0b",
                  background: "#fffbeb",
                  color: "#92400e",
                  fontSize: 12,
                }}
              >
                Advertencia: existen abonos por causa y abono global. Ambos se
                acumulan en la base efectiva.
              </div>
            ) : null}
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
              Generar propuesta (sin aplicar cambios)
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
              Aplicar propuesta a abonos por causa
            </button>
          </div>

          {mensajeFaltantesDistribucion ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#374151",
                fontSize: 12,
              }}
            >
              {mensajeFaltantesDistribucion}
            </div>
          ) : null}

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
                {causasOrdenadas.map((c, idx) => {
                  const sug =
                    sugeridos.find((s) => s.id === c.id)?.nuevoAbono ??
                    c.abonoCausa;
                  const nombreCausa = (c.nombre || "").trim();
                  const etiquetaCausa =
                    nombreCausa.length > 0 ? nombreCausa : `Causa ${idx + 1}`;
                  return (
                    <React.Fragment key={c.id}>
                      <div>{etiquetaCausa}</div>
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
              Ajustes finos de presentacion (uso puntual)
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
              Ajusta solo la <b>fecha mostrada</b> de TM y TM CET. No modifica
              la base ni el motor de calculo; usar solo para correcciones
              operativas de presentacion.
            </div>
            {!inicio || causasOrdenadas.length === 0 ? (
              <div
                style={{
                  marginTop: 4,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  color: "#374151",
                  fontSize: 12,
                }}
              >
                Para usar Ajustes finos, ingresa Inicio y al menos una causa.
              </div>
            ) : (
              <>
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
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      Ajuste TM (+/-1 dia)
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
                      <option value={-1}>-1 dia (adelanta)</option>
                      <option value={0}>0 (sin ajuste)</option>
                      <option value={1}>+1 dia (atrasa)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      Ajuste TM CET (+/-1 dia)
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
                      <option value={-1}>-1 dia (adelanta)</option>
                      <option value={0}>0 (sin ajuste)</option>
                      <option value={1}>+1 dia (atrasa)</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
                  Vista actual: TM <b>{resultados.tm || "-"}</b> | TM CET <b>{resultados.tmCet || "-"}</b>.
                </div>
              </>
            )}
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
              Ingresos manuales de referencia (uso excepcional)
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
              Permite ingresar TM y/o TMBI manual para contraste operativo o
              validacion documental. Si un campo queda vacio, se mantiene el
              valor automatico.
            </div>
            {!inicio || causasOrdenadas.length === 0 ? (
              <div
                style={{
                  marginTop: 4,
                  marginBottom: 8,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  color: "#374151",
                  fontSize: 12,
                }}
              >
                Para usar esta seccion con contexto, ingresa Inicio y al menos
                una causa.
              </div>
            ) : (
              <div style={{ marginBottom: 8, fontSize: 12, color: "#4b5563" }}>
                Referencia automatica actual: TM <b>{tmAuto || "-"}</b> | TMBI{" "}
                <b>{tmbiAuto || "-"}</b>.
              </div>
            )}

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
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  Si no ingresas TM manual, se utiliza TM automatico.
                </div>
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
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  Si no ingresas TMBI manual, se utiliza TMBI automatico.
                </div>
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

      {/* Bot?n flotante: Comentarios */}
      <FeedbackSlideOver gasUrl={GAS_URL} />
    </div>
  );
}
