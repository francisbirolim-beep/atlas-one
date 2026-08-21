# IMPLEMENTATIONS.md — Atlas One

## 2026-08-20 — Correção das figuras técnicas do Plano PC3 — EM VALIDAÇÃO

A coluna FIG. do Plano de Corte PC3 foi corrigida após validação visual do usuário.

Implementado:
- remoção dos SVGs manuais da etapa anterior;
- inclusão de PNGs recortados diretamente do manual técnico Suprema e identificados por código para SU010, SU012, SU008, SU280, SU243, SU242, SU053, SU225 e SU102;
- `lib/planoCortePerfis.ts` aponta somente para esses desenhos comprovados;
- TMC e SU289 permanecem sem figura até existir fonte técnica identificada;
- sem alteração de fórmulas, quantidades, posição, pesos ou banco.

Critério: nunca usar desenho semelhante ou aproximado; vínculo visual precisa ser exato por código.
