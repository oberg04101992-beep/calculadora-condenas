import React from "react";

/**
 * Panel simple, sin variables internas, para explicar al personal
 * cómo se obtiene el resultado en términos prácticos.
 * No muestra ajustes internos (+/-1 entre causas).
 */
export default function ComoSeCalculo() {
  return (
    <details style={{ margin: "16px 0" }} open>
      <summary><strong>¿Cómo se calculó?</strong> (guía simple)</summary>
      <ol style={{ marginTop: 8, lineHeight: 1.5 }}>
        <li><strong>Sumatoria de penas:</strong> se convierten años/meses/días a días y se suman todas las condenas.</li>
        <li><strong>Regla de TM:</strong> según el caso, se aplica <em>1/2</em> (régimen general) o <em>2/3</em> (delitos DL 321 art. 3/3 bis/3 ter).</li>
        <li><strong>Rebajas aplicables:</strong> si corresponde, rebaja simple por art. 17 (no se muestran pasos internos).</li>
        <li><strong>Abonos:</strong> se descuentan del TM para estimar lo restante.</li>
        <li><strong>TMBI:</strong> se fija 12 meses antes del TM (aprox. 30 días por mes).</li>
      </ol>
      <div style={{ marginTop: 8, padding: 8, border: "1px dashed #aaa", fontSize: 13 }}>
        <strong>Notas operativas:</strong>
        <ul>
          <li>Si hay <em>fuga/evasión/revocación</em>, revisar el sistema oficial (Circular 310) por ajustes especiales.</li>
          <li>Si existen <em>multas pendientes</em> o <em>multas convertidas</em>, pueden afectar beneficios o sumar días.</li>
          <li>Para <em>expulsión administrativa</em>, no aplica el cálculo TM/TMBI estándar; se usa la resolución administrativa.</li>
        </ul>
        <p style={{ opacity: 0.8 }}>Esta es una guía transparente para el personal. No muestra detalles internos ni ajustes finos entre causas.</p>
      </div>
    </details>
  );
}