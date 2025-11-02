// src/components/ComoSeCalculo.tsx
/**
 * Contenido del acordeón "Cómo se calculó este cómputo".
 * Lee los datos que ya usa la pantalla (o usa defaults seguros),
 * calcula con la misma función de mínimos y muestra paso a paso
 * + botón "Copiar cálculo escrito".
 */
import React, { useMemo } from "react";
import { calcularMinimos, Regimen, RoundingMode } from "../core/minimos";
import { fmt } from "../lib/fechas";

type Any = any;

export default function ComoSeCalculo(props: Any) {
  const g: Any = (globalThis as Any) || {};
  const p: Any = props?.params || props || {};

  // Inicio
  const inicioRaw: Date | string =
    p.inicio ?? g.inicioISO ?? g.fechaInicio ?? g?.state?.inicioISO ?? new Date(Date.UTC(2021, 5, 17));
  const inicio: Date = inicioRaw instanceof Date ? inicioRaw : new Date(`${inicioRaw}T00:00:00Z`);

  // Causas → suma de días inclusivos
  const causas: Any[] = p.causas ?? g.causas ?? g?.state?.causas ?? [];
  const diasBrutos: number = p.diasBrutos ?? (
    Array.isArray(causas) ? causas.reduce((acc, c) => acc + (Number(c?.diasInclusivos) || 0), 0) : 0
  );

  // Config UI
  const cfg: Any = p.config ?? g.config ?? g.state ?? {};
  const regimen: Regimen = (p.regimen ?? cfg.regimen) === "1/2" ? "1/2" : "2/3";
  const vistaOficial: boolean = typeof (p.vistaOficial ?? cfg.vistaOficial) === "boolean" ? (p.vistaOficial ?? cfg.vistaOficial) : true;
  const abonoMinimos: number = Number(p.abonoMinimos ?? cfg.abonoMinimosGlobal ?? 0);
  const roundingMode: RoundingMode =
    (p.roundingMode ?? cfg.roundingMode) === "pro_reo"
      ? "pro_reo"
      : (p.roundingMode ?? cfg.roundingMode) === "matematico"
      ? "matematico"
      : "oficial";

  // Cálculo
  const result = useMemo(
    () => calcularMinimos({ inicio, diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode }),
    [inicio.getTime(), diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode]
  );

  const { TM_inclusivo, TM_mostrado, TMd_raw, TMd_aplicado, TMBI, CET, CETd_raw, CETd_aplicado, tramo_TMBI_dias } = result;

  // Texto “cálculo escrito”
  const textoEscrito = useMemo(() => {
    const f = regimen === "2/3" ? "2/3" : "1/2";
    return [
      `Cómputo escrito`,
      ``,
      `Datos`,
      `  Inicio (S): ${fmt(inicio)}`,
      `  Brutos (B): ${diasBrutos} días (inclusivo)`,
      `  Abonos que afectan mínimos (Amin): ${abonoMinimos} días`,
      `  Régimen (f): ${f}`,
      `  Vista de mínimos: ${vistaOficial ? "Oficial (exclusiva)" : "Doctrinal"}`,
      `  Criterio de redondeo: ${roundingMode}`,
      ``,
      `1) TM (mínimo) — Modo sistema`,
      `  Fórmula: TMd = ceil(B×f) − ceil(Amin×(1−f))`,
      `  TMd (fracción): ${TMd_raw.toString().replace(".", ",")}`,
      `  Entero aplicado: ${TMd_aplicado} (criterio: ${roundingMode})`,
      `  TM_inclusivo = S + (TMd − 1) = ${fmt(TM_inclusivo)}`,
      `  TM_mostrado (Oficial) = ${fmt(TM_mostrado)}`,
      ``,
      `2) TMBI`,
      `  TMBI = TM_mostrado − 12 meses (fin de mes) = ${fmt(TMBI)}`,
      ``,
      `3) CET`,
      `  D = díasInclusivos(S, TMBI) = ${tramo_TMBI_dias}`,
      `  CETd (fracción): ${CETd_raw.toString().replace(".", ",")}`,
      `  Entero aplicado CETd: ${CETd_aplicado} (criterio: ${roundingMode})`,
      `  CET = S + (CETd − 1) = ${fmt(CET)}`,
      ``,
      `Resultados`,
      `  TM: ${fmt(TM_mostrado)} · TMBI: ${fmt(TMBI)} · CET: ${fmt(CET)}`
    ].join("\n");
  }, [inicio.getTime(), diasBrutos, abonoMinimos, regimen, vistaOficial, roundingMode,
      TM_inclusivo, TM_mostrado, TMd_raw, TMd_aplicado, TMBI, CET, CETd_raw, CETd_aplicado, tramo_TMBI_dias]);

  const copiar = async () => {
    await navigator.clipboard.writeText(textoEscrito);
    alert("Cálculo escrito copiado.");
  };

  // Render dentro del acordeón
  return (
    <div style={{ fontSize: 14, lineHeight: 1.4 }}>
      <p><b>TMd (fracción):</b> {TMd_raw} → <b>entero aplicado:</b> {TMd_aplicado} ({roundingMode})</p>
      <p><b>TM (mostrado):</b> {fmt(TM_mostrado)} · <b>TM inclusivo:</b> {fmt(TM_inclusivo)}</p>
      <p><b>TMBI:</b> {fmt(TMBI)}</p>
      <p><b>Días S→TMBI (incl.):</b> {tramo_TMBI_dias}</p>
      <p><b>CETd (fracción):</b> {CETd_raw} → <b>entero aplicado:</b> {CETd_aplicado} ({roundingMode})</p>
      <p><b>CET:</b> {fmt(CET)}</p>
      <button onClick={copiar} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "#2563eb", color: "#fff", border: 0 }}>
        Copiar cálculo escrito
      </button>
    </div>
  );
}
