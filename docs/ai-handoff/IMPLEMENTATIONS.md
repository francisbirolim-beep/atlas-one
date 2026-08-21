# IMPLEMENTATIONS.md — Atlas One

## 2026-08-20 — Plano de Corte V4 com perfis técnicos — PR #216

Implementação em validação na branch `fix/plano-corte-perfis-v4`, sem migration e sem alteração de banco.

### Código
- `lib/planoCortePerfis.ts`: consulta cadastro real de perfis, resolve linhas concretas do relatório PC3, quantidades/posições validadas e peso por linha.
- `app/engenharia/formulas-corte/page.tsx`: tabela final no formato `FIG. | CÓDIGO | DESCRIÇÃO | CORTE | QTDE. | POS. | PESO`, imagens, peso da esquadria e impressão A4.
- `public/perfis/plano-corte/*.svg`: desenhos técnicos auditados para SU010, TMC, SU012, SU008, SU280, SU243, SU242, SU053, SU225 e SU102.

### Regras técnicas desta etapa
- `produtos.foto_url` tem prioridade; desenho estático é fallback por código exato.
- PC3 Suprema usa quantidades/posições repetidamente confirmadas em orientativos reais W.Vetro.
- `travessas` vira SU053 + SU225 + SU102(L), preservando o mesmo corte calculado pelo motor.
- `SU102(H)` vira SU102 posição H.
- peso = `peso_kg_m × corte(m) × quantidade`.
- outras tipologias continuam sem quantidade/peso inferidos.

### Evidência usada
Orientativos W.Vetro PC3 reais confirmam, em diferentes medidas, SU010 1L, TMC 3L, SU012 2H, SU008 2H, SU053 3L, SU225 3L, SU280 2H, 2 montantes de mão-de-amigo internos, 2 externos, SU102 6L e SU102 6H. Os pesos do cadastro Atlas por metro reproduzem os pesos dos orientativos para as peças auditadas.

## 2026-08-20 — Plano de Corte V4 — PR #215
- dois modos: obra/medição final e manual;
- nº orçamento, item, localização, status medição, quantidade, medidas finais, cores, vidro e observações;
- cabeçalho com origem e data/hora.

## 2026-08-20 — Plano de Corte imprimível — PR #214
Primeiro relatório imprimível A4 a partir do motor de fórmulas.

## 2026-08-20 — Fórmulas de corte — PRs #210, #211 e #213
- motor declarativo seguro;
- migration autorizada aplicada no Supabase;
- interface ligada ao banco;
- navegação própria da Engenharia.
