// src/store/config.ts
export interface AppConfig {
  regimen: '1/2' | '2/3';
  vistaOficial: boolean;
  abonoMinimosGlobal: number;
  roundingMode: 'oficial' | 'pro_reo' | 'matematico';
  ordenarAutomatico: boolean;
}

export const defaultConfig: AppConfig = {
  regimen: '2/3',
  vistaOficial: true,
  abonoMinimosGlobal: 0,
  roundingMode: 'oficial',
  ordenarAutomatico: true
};