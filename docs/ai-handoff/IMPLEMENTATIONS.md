# IMPLEMENTATIONS.md — Atlas One

## 2026-08-20 — Figuras exatas SU289 e SU290 no Plano PC3 — EM VALIDAÇÃO

Implementado:
- extração dos desenhos de SU289 e SU290 diretamente da coluna `Figura` do orientativo W.Vetro nº 994 da configuração `*SUCB-PC3-01EF`;
- inclusão de `public/perfis/plano-corte/SU289.png` e `SU290.png`;
- `lib/planoCortePerfis.ts` passa a vincular os dois códigos aos respectivos recortes;
- preservadas as figuras já validadas dos demais códigos;
- TMC continua sem figura até existir fonte técnica exata;
- sem alteração de fórmulas, cortes, quantidades, posições, pesos ou banco;
- sem migration.

Critério: nunca usar desenho semelhante ou aproximado; o vínculo visual precisa ser exato por código e sustentado pela fonte técnica.
