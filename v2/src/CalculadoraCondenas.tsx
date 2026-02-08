import { useMemo, useState } from "react";

type Duracion = { years: number; months: number; days: number };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Autoguionado: permite escribir ddmmaaaa y lo transforma a DD-MM-AAAA
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  let out = dd;
  if (mm.length) out += "-" + mm;
  if (yyyy.length) out += "-" + yyyy;
  return out;
}

export function isValidDDMMYYYY(value: string): boolean {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [ddS, mmS, yyS] = value.split("-");
  const dd = Number(ddS);
  const mm = Number(mmS);
  const yy = Number(yyS);
  if (yy < 1900 || yy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;

  // Validación por fecha real (UTC)
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  return (
    d.getUTCFullYear() === yy &&
    d.getUTCMonth() === mm - 1 &&
    d.getUTCDate() === dd
  );
}

export function parseDDMMYYYYToUTC(value: string): Date | null {
  if (!isValidDDMMYYYY(value)) return null;
  const [ddS, mmS, yyS] = value.split("-");
  const dd = Number(ddS);
  const mm = Number(mmS);
  const yy = Number(yyS);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function addDurationUTC(start: Date, dur: Duracion): Date {
  // Importante: trabajar en UTC y respetar fin de mes
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();

  function addDaysUTC(start: Date, days: number): Date {
  return new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + days
  ));
}

  // Primero años/meses
  let targetY = y + (dur.years || 0);
  let targetM = m + (dur.months || 0);

  // Normaliza meses
  targetY += Math.floor(targetM / 12);
  targetM = ((targetM % 12) + 12) % 12;

  // Ajuste por fin de mes: si el día no existe, cae al último día del mes
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const safeDay = Math.min(d, lastDay);

  let out = new Date(Date.UTC(targetY, targetM, safeDay));

  // Luego días
  if (dur.days) {
    out = new Date(
      Date.UTC(out.getUTCFullYear(), out.getUTCMonth(), out.getUTCDate() + dur.days)
    );
  }
  return out;
}

function formatUTCDate(d: Date): string {
  return `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

function clampInt(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function CalculadoraCondenas() {
  const [inicio, setInicio] = useState("");
  const [causas, setCausas] = useState<Duracion[]>([{ years: 0, months: 0, days: 0 }]);
  const [abonoGlobal, setAbonoGlobal] = useState(0);

  const inicioUTC = useMemo(() => parseDDMMYYYYToUTC(inicio), [inicio]);

  const totalDuracion = useMemo(() => {
    return causas.reduce(
      (acc, c) => ({
        years: acc.years + (c.years || 0),
        months: acc.months + (c.months || 0),
        days: acc.days + (c.days || 0),
      }),
      { years: 0, months: 0, days: 0 }
    );
  }, [causas]);

  const terminoOriginalUTC = useMemo(() => {
    if (!inicioUTC) return null;
    return addDurationUTC(inicioUTC, totalDuracion);
  }, [inicioUTC, totalDuracion]);

  // MVP: TM/TMBI placeholder (aprox)
  const diasAprox = useMemo(() => {
    const raw = totalDuracion.years * 365 + totalDuracion.months * 30 + totalDuracion.days;
    const net = Math.max(0, raw - (abonoGlobal || 0));
    return { raw, net };
  }, [totalDuracion, abonoGlobal]);

  const tmAprox = useMemo(() => diasAprox.net / 2, [diasAprox.net]);
  const tmbiAprox = useMemo(() => (diasAprox.net * 2) / 3, [diasAprox.net]);

  const alertaFraccionTM = useMemo(() => {
    const frac = tmAprox - Math.floor(tmAprox);
    return frac >= 0.5;
  }, [tmAprox]);

  const alertaFraccionTMBI = useMemo(() => {
    const frac = tmbiAprox - Math.floor(tmbiAprox);
    return frac >= 0.5;
  }, [tmbiAprox]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Calculadora de Cómputos — v2 (MVP)</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Fechas en UTC, autoguión DD-MM-AAAA, causas dinámicas. TM/TMBI aquí están en modo MVP (aprox).
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Entradas</h3>

          <label style={{ display: "block", marginBottom: 8 }}>
            Fecha de inicio (DD-MM-AAAA)
            <input
              value={inicio}
              onChange={(e) => setInicio(formatDateInput(e.target.value))}
              placeholder="01-01-2025"
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6, borderRadius: 10 }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <strong>Causas</strong>
            <button
              type="button"
              onClick={() => setCausas((prev) => [...prev, { years: 0, months: 0, days: 0 }])}
              style={{ padding: "8px 10px", borderRadius: 10 }}
            >
              + Agregar causa
            </button>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {causas.map((c, idx) => (
              <div key={idx} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Causa #{idx + 1}</strong>
                  {causas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCausas((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ padding: "6px 10px", borderRadius: 10, opacity: 0.9 }}
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
                  <label>
                    Años
                    <input
                      value={c.years}
                      onChange={(e) =>
                        setCausas((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, years: clampInt(e.target.value) } : x))
                        )
                      }
                      inputMode="numeric"
                      style={{ display: "block", width: "100%", padding: 8, borderRadius: 10, marginTop: 6 }}
                    />
                  </label>
                  <label>
                    Meses
                    <input
                      value={c.months}
                      onChange={(e) =>
                        setCausas((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, months: clampInt(e.target.value) } : x))
                        )
                      }
                      inputMode="numeric"
                      style={{ display: "block", width: "100%", padding: 8, borderRadius: 10, marginTop: 6 }}
                    />
                  </label>
                  <label>
                    Días
                    <input
                      value={c.days}
                      onChange={(e) =>
                        setCausas((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, days: clampInt(e.target.value) } : x))
                        )
                      }
                      inputMode="numeric"
                      style={{ display: "block", width: "100%", padding: 8, borderRadius: 10, marginTop: 6 }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            Abono global (días)
            <input
              value={abonoGlobal}
              onChange={(e) => setAbonoGlobal(clampInt(e.target.value))}
              inputMode="numeric"
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6, borderRadius: 10 }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>TO (Término Original)</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {terminoOriginalUTC ? formatUTCDate(terminoOriginalUTC) : "—"}
            </div>
          </div>

          <div style={{ border: "2px solid rgba(0,0,0,0.25)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>TM (MVP aprox)</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {inicioUTC ? `${Math.floor(tmAprox)} días` : "—"}

            </div>
            {alertaFraccionTM && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                ⚠️ Fracción ≥ 0,5: podría considerarse día siguiente (criterio institucional).
              </div>
            )}
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>TMBI (MVP aprox)</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {inicioUTC ? `${Math.floor(tmbiAprox)} días` : "—"}

            </div>
            {alertaFraccionTMBI && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                ⚠️ Fracción ≥ 0,5: podría considerarse día siguiente (criterio institucional).
              </div>
            )}
          </div>
        </div>

        <details style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>¿Cómo se calculó? (MVP)</summary>
          <div style={{ marginTop: 10, lineHeight: 1.5 }}>
            <div>• Inicio: {inicioUTC ? formatUTCDate(inicioUTC) : "—"}</div>
            <div>
              • Total duración (suma simple): {totalDuracion.years} años, {totalDuracion.months} meses,{" "}
              {totalDuracion.days} días
            </div>
            <div>• Abono global aplicado: {abonoGlobal} días</div>
            <div>• Días aprox brutos: {diasAprox.raw}</div>
            <div>• Días aprox netos: {diasAprox.net}</div>
            <div>• TM aprox: neto / 2 = {tmAprox.toFixed(2)}</div>
            <div>• TMBI aprox: neto * 2/3 = {tmbiAprox.toFixed(2)}</div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default CalculadoraCondenas;