// src/store/config.ts
export interface AppConfig {
  regimen: '1/2' | '2/3';
  vistaOficial: boolean; // true = "Oficial (exclusiva)"
  abonoMinimosGlobal: number; // "Abonos que afectan mínimos (global)"
  roundingMode: 'oficial' | 'pro_reo' | 'matematico';
  ordenarAutomatico: boolean; // si false => orden manual con flechas
}

export const defaultConfig: AppConfig = {
  regimen: '2/3',
  vistaOficial: true,
  abonoMinimosGlobal: 0,
  roundingMode: 'oficial',
  ordenarAutomatico: true
};