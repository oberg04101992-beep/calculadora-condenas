import { CondicionesEspeciales, ReglaTM } from '../types/calculo';

/**
 * totalPenaDias: suma de TODAS las penas ya convertidas a días.
 * abonoTotalDias: abono total ya aplicado (opcional).
 * reglaPreferida: MITAD (1/2) o DOS_TERCIOS (2/3). Si delitoEspecial=true, forzamos 2/3.
 * tmbiMeses: por norma simple, 12.
 */
export function calcularTM_y_TMBI(params: {
  totalPenaDias: number;
  abonoTotalDias?: number;
  reglaPreferida: ReglaTM;
  condiciones: CondicionesEspeciales;
  tmbiMeses?: number; // default 12
}) {
  const {
    totalPenaDias,
    abonoTotalDias = 0,
    reglaPreferida,
    condiciones,
    tmbiMeses = 12,
  } = params;

  if (condiciones.expulsionAdministrativa) {
    return {
      aplicaCalculoEstandar: false,
      tmDias: null,
      tmbiDiasDesdeInicio: null,
      mensajes: [
        'Régimen de expulsión administrativa detectado: no aplica TM/TMBI estándar.',
      ],
    };
  }

  const penaConMulta = totalPenaDias + Math.max(0, condiciones.multasConvertidasDias || 0);

  const regla: ReglaTM = condiciones.delitoEspecial ? 'DOS_TERCIOS' : reglaPreferida;

  let tmBase = 0;
  if (regla === 'MITAD') tmBase = Math.ceil(penaConMulta * 0.5);
  else if (regla === 'DOS_TERCIOS') tmBase = Math.ceil(penaConMulta * (2 / 3));
  else tmBase = penaConMulta;

  const rebaja17 = Math.max(0, condiciones.rebajaArt17Dias || 0);
  let tmTrasRebaja = Math.max(0, tmBase - rebaja17);

  const tmRestanteDias = Math.max(0, tmTrasRebaja - abonoTotalDias);

  const diasPorMes = 30;
  const tmbiDiasDesdeInicio = Math.max(0, tmTrasRebaja - (tmbiMeses * diasPorMes));

  const mensajes: string[] = [];

  if (condiciones.fugaEvasionRevocacion) {
    mensajes.push('Atención: fuga/evasión/revocación marcada (Circular 310). Revisar TM/TMBI oficial.');
  }
  if (condiciones.penasMenorIgualUnAnio) {
    mensajes.push('Penas ≤ 1 año: validación administrativa distinta. Ver Instructivo 2019.');
  }
  if ((condiciones.multasPendientesUTM || 0) > 0) {
    mensajes.push(`Multas pendientes: ${condiciones.multasPendientesUTM} UTM. Pueden afectar beneficios.`);
  }
  if (condiciones.delitoEspecial) {
    mensajes.push('Delito con regla de 2/3 (DL 321 art. 3/3 bis/3 ter).');
  }
  if (rebaja17 > 0) {
    mensajes.push(`Rebaja simple considerada: art. 17 Ley 19.856 = ${rebaja17} días.`);
  }

  return {
    aplicaCalculoEstandar: true,
    reglaUsada: regla,
    tmDias: tmTrasRebaja,
    tmRestanteDias,
    tmbiDiasDesdeInicio,
    mensajes,
  };
}