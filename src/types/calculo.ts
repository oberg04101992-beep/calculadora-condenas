export type ReglaTM = 'MITAD' | 'DOS_TERCIOS' | 'NINGUNA';

export interface CondicionesEspeciales {
  delitoEspecial: boolean;           // DL 321 art. 3/3 bis/3 ter → 2/3
  fugaEvasionRevocacion: boolean;    // Circular 310 (solo alerta)
  penasMenorIgualUnAnio: boolean;    // Flujo distinto (solo alerta)
  expulsionAdministrativa: boolean;  // Régimen distinto (bloquea cálculo estándar)
  multasPendientesUTM: number;       // Solo alerta
  multasConvertidasDias: number;     // Suma simple a la pena total
  rebajaArt17Dias: number;           // Rebaja simple (opcional)
}