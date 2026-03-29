# Casos de Validación Funcional

## Tabla de contenido
- [Caso 1 — Mixta 2/3](#caso-1--mixta-23)
- [Caso 2 — Abono global único 1/2](#caso-2--abono-global-unico-12)
- [Caso 3 — Abono por causa + global 1/2](#caso-3--abono-por-causa--global-12)
- [Caso 4 — Acumulado 2/3](#caso-4--acumulado-23)
- [Caso 5 — Largo 2/3](#caso-5--largo-23)
- [Caso 6 — Solo días](#caso-6--solo-dias)
- [Caso 7 — Solo años](#caso-7--solo-anos)
- [Caso 8 — Régimen mixto con arrastre a 2/3](#caso-8--regimen-mixto-con-arrastre-a-23)
- [Uso recomendado](#uso-recomendado)

## Caso 1 — Mixta 2/3

**Nombre del caso**  
Mixta 2/3

**Objetivo**  
Validar cálculo en causa mixta (años + días) bajo régimen 2/3, sin abonos.

**Datos de entrada**
- Inicio: `16/04/2020`
- Causas: `1`
- Causa 1: `6 años, 0 meses, 600 días`
- Régimen: `2/3`
- Abono por causa: `0`
- Abono global: `0`

**Resultado esperado**
- Brutos: `2792`
- TO: `07/12/2027`
- TM: `21/05/2025`
- TMBI: `21/05/2024`
- TM CET: `08/01/2023`

**Observaciones**
- Caso de referencia principal para validar mezcla de años y días.

## Caso 2 — Abono global único 1/2

**Nombre del caso**  
Abono global único 1/2

**Objetivo**  
Verificar impacto de abono global único sobre base efectiva y mínimos en régimen 1/2.

**Datos de entrada**
- Inicio: `04/10/2020`
- Causas: `1`
- Causa 1: `4 años, 11 meses, 0 días`
- Régimen: `1/2`
- Abono por causa: `0`
- Abono global: `125`

**Resultado esperado**
- Brutos: `1797`
- Base efectiva: `1672`
- TO: `02/05/2025`
- TM: `18/01/2023`
- TMBI: `18/01/2022`
- TM CET: `14/08/2021`

**Observaciones**
- Útil para validar que el abono global se descuente una sola vez.

## Caso 3 — Abono por causa + global 1/2

**Nombre del caso**  
Abono por causa + global 1/2

**Objetivo**  
Validar acumulación de abono por causa y abono global en régimen 1/2.

**Datos de entrada**
- Inicio: `04/10/2020`
- Causas: `1`
- Causa 1: `4 años, 11 meses, 0 días`
- Régimen: `1/2`
- Abono por causa: `125`
- Abono global: `125`

**Resultado esperado**
- Brutos: `1797`
- Base efectiva: `1547`
- Total abonos: `250`
- TO: `28/12/2024`
- TM: `16/11/2022`
- TMBI: `16/11/2021`
- TM CET: `03/07/2021`

**Observaciones**
- Permite detectar doble descuento no deseado o errores de acumulación.

## Caso 4 — Acumulado 2/3

**Nombre del caso**  
Acumulado 2/3

**Objetivo**  
Comprobar cómputo acumulado con dos causas largas en régimen 2/3.

**Datos de entrada**
- Inicio: `17/06/2021`
- Causas: `2`
- Causa 1: `7 años, 0 meses, 0 días`
- Régimen causa 1: `2/3`
- Causa 2: `7 años, 0 meses, 0 días`
- Régimen causa 2: `2/3`
- Abonos: `0`

**Resultado esperado**
- TO: `18/06/2035`
- TM: `18/10/2030`
- TMBI: `18/10/2029`
- TM CET: `07/01/2027`

**Observaciones**
- Caso de control para acumulación sin abonos.

## Caso 5 — Largo 2/3

**Nombre del caso**  
Largo 2/3

**Objetivo**  
Validar estabilidad de mínimos en una condena extensa con días adicionales.

**Datos de entrada**
- Inicio: `28/01/2023`
- Causas: `1`
- Causa 1: `17 años, 0 meses, 541 días`
- Régimen: `2/3`
- Abonos: `0`

**Resultado esperado**
- TO: `22/07/2041`
- TM: `24/05/2035`
- TMBI: `24/05/2034`
- TM CET: `14/08/2030`

**Observaciones**
- Sensible a desfases por redondeo y cierre de tramo.

## Caso 6 — Solo días

**Nombre del caso**  
Solo días

**Objetivo**  
Verificar comportamiento en condena corta expresada únicamente en días.

**Datos de entrada**
- Inicio: `01/01/2022`
- Causas: `1`
- Causa 1: `0 años, 0 meses, 30 días`
- Régimen: `1/2`
- Abonos: `0`

**Resultado esperado**
- Brutos: `30`
- TO: `30/01/2022`
- TM: `16/01/2022`
- TMBI: `01/01/2022`
- TM CET: `01/01/2022`

**Observaciones**
- Caso clave para validar que TMBI no quede antes del inicio.

## Caso 7 — Solo años

**Nombre del caso**  
Solo años

**Objetivo**  
Confirmar cálculo estándar con causa simple en años y régimen 1/2.

**Datos de entrada**
- Inicio: `15/03/2022`
- Causas: `1`
- Causa 1: `5 años, 0 meses, 0 días`
- Régimen: `1/2`
- Abonos: `0`

**Resultado esperado**
- Brutos: `1827`
- TO: `15/03/2027`
- TM: `12/09/2024`
- TMBI: `12/09/2023`
- TM CET: `13/03/2023`

**Observaciones**
- Caso base para comparación con escenarios mixtos.

## Caso 8 — Régimen mixto con arrastre a 2/3

**Nombre del caso**  
Régimen mixto con arrastre a 2/3

**Objetivo**  
Verificar arrastre de régimen del expediente a 2/3 cuando existe causa 2/3.

**Datos de entrada**
- Inicio: `01/01/2022`
- Causas: `2`
- Causa 1: `3 años, 0 meses, 0 días`
- Régimen causa 1: `1/2`
- Causa 2: `5 años, 0 meses, 0 días`
- Régimen causa 2: `2/3`
- Abonos: `0`

**Resultado esperado**
- TO: `02/01/2030`
- TM: `04/05/2027`
- TMBI: `04/05/2026`
- TM CET: `22/11/2024`
- Régimen aplicado: `2/3`

**Observaciones**
- Este caso se usa para verificar arrastre de régimen del expediente, más que como referencia cerrada externa.

## Uso recomendado

- Ejecutar estos casos después de cualquier cambio relacionado con lógica de cálculo.
- Utilizarlos como suite manual de control para detectar regresiones funcionales.
- Si un caso deja de coincidir, revisar y resolver antes de publicar o desplegar.
