import React, { useMemo, useState } from "react";
import { repartirAbonos, CausaBase, PropuestaDistribucion, ModoDistribucion } from "../lib/repartirAbonos";

export type CausaVista = {
  id: string;
  nombre?: string;
  duracionBrutaDias: number; // largo real de la causa (en días, ya con calendario)
  abonoCausa: number;        // abono ya aplicado a la causa
};

type Props = {
  causas: CausaVista[];
  toActualDMY?: string; // TO actual (DD/MM/AAAA) para simular por término
  aplicarDistribucionAlTermino?: boolean;
  onAplicarDistribucion: (updates: { id: string; nuevoAbono: number }[]) => void;
  onSimularResultados?: (tempAbonosPorCausa: { id: string; nuevoAbono: number }[]) => void;
  /** Nuevo: copia el total asignado de la previa a “Abonos totales del expediente” (padre). */
  onUsarTotalAsignado?: (n: number) => void;
};

function parseDMY(dmy: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  return isNaN(dt.getTime()) ? null : dt;
}

const DAY = 24 * 60 * 60 * 1000;

export default function AbonosDistribucion({
  causas,
  toActualDMY,
  aplicarDistribucionAlTermino,
  onAplicarDistribucion,
  onSimularResultados,
  onUsarTotalAsignado,
}: Props) {
  const [modo, setModo] = useState<ModoDistribucion>("gravosas");
  const [abonoTotal, setAbonoTotal] = useState<number>(0);
  const [preview, setPreview] = useState<PropuestaDistribucion | null>(null);

  // Término esperable
  const [terminoEsperable, setTerminoEsperable] = useState<string>("");
  const [mensaje, setMensaje] = useState<string>("");

  const capacidadTotal = useMemo(
    () => causas.reduce((s, c) => s + Math.max(0, c.duracionBrutaDias - c.abonoCausa), 0),
    [causas]
  );

  const construirUpdates = (prop: PropuestaDistribucion) =>
    prop.items
      .filter(i => i.propuesto > 0)
      .map(i => {
        const actual = causas.find(c => c.id === i.id)!.abonoCausa;
        return { id: i.id, nuevoAbono: actual + i.propuesto };
      });

  const previsualizarCon = (prop: PropuestaDistribucion, nota = "") => {
    setPreview(prop);
    setMensaje(nota);
    if (onSimularResultados) onSimularResultados(construirUpdates(prop));
  };

  const handlePrevisualizar = () => {
    const base: CausaBase[] = causas.map(c => ({
      id: c.id, nombre: c.nombre, duracionBrutaDias: c.duracionBrutaDias, abonoCausa: c.abonoCausa,
    }));
    const prop = repartirAbonos(base, abonoTotal, modo);
    previsualizarCon(prop, "");
  };

  // ------- Simulación por Término esperable con ajuste ±1 día -------
  const handleSimularPorTermino = () => {
    if (!toActualDMY) {
      setMensaje("No se pudo leer el Término actual para simular. Ingresa datos del expediente.");
      return;
    }
    const toActual = parseDMY(toActualDMY);
    const toMeta = parseDMY(terminoEsperable);
    if (!toMeta) { setMensaje("Fecha esperable inválida. Usa DD/MM/AAAA."); return; }
    if (!toActual) { setMensaje("Término actual inválido. Revisa el inicio y las causas."); return; }

    // Si la meta es igual o posterior al TO actual, no corresponde descontar.
    const diffExclusive = Math.floor((toActual.getTime() - toMeta.getTime()) / DAY);
    if (diffExclusive <= 0) {
      setMensaje("La fecha esperable es igual o posterior al Término actual. No hay días que descontar.");
      setPreview(null);
      return;
    }

    const base: CausaBase[] = causas.map(c => ({
      id: c.id, nombre: c.nombre, duracionBrutaDias: c.duracionBrutaDias, abonoCausa: c.abonoCausa,
    }));

    // Intento 1: diferencia exclusiva
    let prop = repartirAbonos(base, diffExclusive, modo);
    let asignado = prop.totalAsignado;
    let toEstimado = new Date(toActual.getTime() - asignado * DAY);

    // Si seguimos por encima de la meta y aún hay capacidad, intento inclusivo (+1)
    if (toEstimado.getTime() > toMeta.getTime() && asignado < capacidadTotal) {
      const prop2 = repartirAbonos(base, diffExclusive + 1, modo);
      const asignado2 = prop2.totalAsignado;
      const toEstimado2 = new Date(toActual.getTime() - asignado2 * DAY);
      if (toEstimado2.getTime() <= toMeta.getTime()) {
        previsualizarCon(prop2, "Ajuste aplicado: +1 día (criterio inclusivo).");
        return;
      }
    }

    // Si nos pasamos por 1 día (quedó antes de la meta), probamos -1
    if (toEstimado.getTime() < toMeta.getTime() && diffExclusive > 1) {
      const prop2 = repartirAbonos(base, diffExclusive - 1, modo);
      const asignado2 = prop2.totalAsignado;
      const toEstimado2 = new Date(toActual.getTime() - asignado2 * DAY);
      if (toEstimado2.getTime() >= toMeta.getTime()) {
        previsualizarCon(prop2, "Ajuste aplicado: −1 día para cuadrar con el término.");
        return;
      }
    }

    // Si no fue necesario/posible ajustar, mostramos el 1er intento y advertencias si corresponde
    let nota = "";
    const faltan = (diffExclusive - asignado);
    if (faltan > 0) {
      nota = `Advertencia: con la capacidad disponible no se alcanza el Término esperable. Faltan ${faltan} día(s).`;
    } else if (aplicarDistribucionAlTermino === false) {
      nota = "Nota: para que el Término cambie según esta simulación, activa “Aplicar distribución al Término”.";
    }
    previsualizarCon(prop, nota);
  };

  const handleAplicar = () => {
    if (!preview) return;
    if (aplicarDistribucionAlTermino === false) {
      setMensaje("Para que el TO cambie al aplicar, activa “Aplicar distribución al Término”.");
      return;
    }
    onAplicarDistribucion(construirUpdates(preview));
    setPreview(null);
  };

  const totalAsignado = preview?.totalAsignado ?? 0;
  const remanente = preview?.remanente ?? Math.max(0, abonoTotal);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 8 }}>
      {/* Bloque 1: Reparto manual (previa → aplicar) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Abono total a repartir (días)</label>
          <input
            type="number"
            min={0}
            value={abonoTotal}
            onChange={e => setAbonoTotal(Number(e.target.value || 0))}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #d1d5db" }}
            placeholder="Ej: 200"
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Capacidad total disponible: <b>{capacidadTotal}</b> días
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Modo de distribución</label>
          <div style={{ display: "flex", gap: 12, paddingTop: 6 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name="modo" checked={modo === "gravosas"} onChange={() => setModo("gravosas")} />
              Gravosas (largo → corto)
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name="modo" checked={modo === "proporcional"} onChange={() => setModo("proporcional")} />
              Proporcional
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={handlePrevisualizar}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111827", background: "white", color: "#111827", cursor: "pointer" }}
          >
            Previsualizar distribución
          </button>
          <button
            disabled={!preview || preview.totalAsignado === 0 || aplicarDistribucionAlTermino === false}
            onClick={handleAplicar}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background:
                !preview || preview.totalAsignado === 0 || aplicarDistribucionAlTermino === false
                  ? "#93c5fd"
                  : "#2563eb",
              color: "white",
              cursor:
                !preview || preview.totalAsignado === 0 || aplicarDistribucionAlTermino === false
                  ? "not-allowed"
                  : "pointer",
            }}
            title={
              !preview
                ? "Primero previsualiza"
                : aplicarDistribucionAlTermino === false
                ? "Activa “Aplicar distribución al Término” para que el TO cambie"
                : undefined
            }
          >
            Aplicar distribución
          </button>
        </div>
      </div>

      {/* Bloque 2: Término esperable */}
      <div style={{ marginTop: 12, borderTop: "1px dashed #e5e7eb", paddingTop: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
          Término esperable (DD/MM/AAAA)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
          <input
            value={terminoEsperable}
            onChange={(e) => {
              let v = e.target.value.replace(/[^\d/]/g, "");
              if (/^\d{2}$/.test(v)) v = v + "/";
              if (/^\d{2}\/\d{2}$/.test(v)) v = v + "/";
              setTerminoEsperable(v.slice(0, 10));
            }}
            placeholder="DD/MM/AAAA"
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <button
            onClick={handleSimularPorTermino}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111827", background: "#fff", cursor: "pointer" }}
          >
            Simular por término
          </button>
        </div>

        {mensaje && <div style={{ marginTop: 8, fontSize: 12, color: "#b45309" }}>{mensaje}</div>}

        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
          TO actual: <b>{toActualDMY ?? "—"}</b>
          {!aplicarDistribucionAlTermino && (
            <> · Nota: para que el TO cambie al aplicar, activa <b>“Aplicar distribución al Término”</b>.</>
          )}
        </div>
      </div>

      {/* Vista previa (común a ambos flujos) */}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Modo: <b>{preview.modo}</b> — Solicitado: <b>{preview.totalSolicitado}</b> días ·
            Asignado: <b>{preview.totalAsignado}</b> días · Remanente: <b>{preview.remanente}</b> días
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {preview.items.map(item => {
              const c = causas.find(x => x.id === item.id)!;
              const label = c.nombre ? c.nombre : `Causa ${c.id}`;
              const agotada = item.capacidad === 0;
              const borde = agotada ? "#ef4444" : item.capped ? "#f59e0b" : "#93c5fd";
              return (
                <div
                  key={item.id}
                  style={{
                    border: `1px solid ${borde}`,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    background: "#f9fafb",
                  }}
                  title={`Capacidad: ${item.capacidad} · Abono actual: ${c.abonoCausa} · Propuesto: ${item.propuesto}`}
                >
                  {label}: +{item.propuesto} (cap {item.capacidad})
                  {agotada ? " — sin capacidad" : item.capped ? " — capado" : ""}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => onUsarTotalAsignado?.(preview.totalAsignado)}
              disabled={preview.totalAsignado === 0}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #0ea5e9",
                background: preview.totalAsignado === 0 ? "#bae6fd" : "#0ea5e9",
                color: "white",
                cursor: preview.totalAsignado === 0 ? "not-allowed" : "pointer",
              }}
              title="Copiar este total a “Abonos totales del expediente”"
            >
              Usar total asignado para TM/TMBI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}