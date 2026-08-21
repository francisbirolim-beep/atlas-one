# IMPLEMENTATIONS.md — Atlas One

## 2026-08-21 — Tipo de esquadria livre no Orçamento Rápido — EM VALIDAÇÃO

Implementado:
- novo campo visível `Tipo de esquadria / descrição livre` no seletor do orçamento;
- o campo reaproveita `tipoOutroTexto` e define `tipo = outro`, sem criar schema paralelo;
- Linha e Modelo / Tipologia passam a ser apresentados como opcionais;
- descrição livre pode ser usada sem Linha e sem Modelo, permitindo enviar itens ainda não cadastrados tecnicamente;
- uma Linha opcional pode ser escolhida sem apagar a descrição livre;
- escolher uma Tipologia cadastrada limpa o texto livre e volta ao fluxo técnico normal;
- sem alteração de banco e sem migration.

## 2026-08-20 — Figuras exatas SU289 e SU290 no Plano PC3 — VALIDADO VISUALMENTE

Implementado:
- extração dos desenhos de SU289 e SU290 diretamente da coluna `Figura` do orientativo W.Vetro nº 994 da configuração `*SUCB-PC3-01EF`;
- inclusão de `public/perfis/plano-corte/SU289.png` e `SU290.png`;
- `lib/planoCortePerfis.ts` vincula os dois códigos aos respectivos recortes;
- sem alteração de fórmulas, cortes, quantidades, posições, pesos ou banco.

Pendente técnico: TMC ainda precisa de desenho exato validado por código.
