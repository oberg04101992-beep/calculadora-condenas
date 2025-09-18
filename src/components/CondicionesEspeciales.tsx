// src/components/CondicionesEspeciales.tsx
import React from "react";

/**
 * Panel de “Condiciones especiales”.
 * Hoy es un contenedor seguro y auto-contenido que NO toca el cómputo.
 * Lo importante es que sea un MÓDULO TS válido para evitar TS1208.
 */
export default function CondicionesEspeciales() {
  return (
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
        Condiciones especiales (vista informativa)
      </div>

      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>
        Este panel permite documentar situaciones excepcionales del expediente
        (por ejemplo: fuga/evasi&oacute;n, quebrantamiento, beneficios, etc.).
        <br />
        <br />
        <b>Nota:</b> Esta versi&oacute;n no altera el c&oacute;mputo; es solo
        informativa. Cuando tengamos reglas cerradas, acá podremos incorporar
        l&oacute;gica específica.
      </div>
    </div>
  );
}

// Asegura que el archivo sea tratado como "módulo" bajo --isolatedModules
// (si en el futuro se elimina el export default, este export vacío evita TS1208).
export {};