# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — DESENHOS TÉCNICOS PC3 CORRIGIDOS — 2026-08-20

O Plano de Corte PC3 mantém a estrutura V4 aprovada e a tabela `FIG. | CÓDIGO | DESCRIÇÃO | CORTE | QTDE. | POS. | PESO`.

Correção atual:
- os SVGs desenhados manualmente na etapa anterior foram removidos porque o teste visual mostrou divergências;
- as figuras de SU010, SU012, SU008, SU280, SU243, SU242, SU053, SU225 e SU102 agora são recortes diretos das seções técnicas identificadas por código no manual Suprema;
- TMC e SU289 ficam sem figura (`—`) enquanto não houver uma seção/fonte com o desenho identificado por código;
- nenhum desenho é inferido por semelhança;
- quantidades, posições, cortes e pesos do PC3 permanecem como na implementação anterior;
- sem migration e sem alteração de banco.

Regra permanente: figura técnica só pode aparecer quando houver vínculo exato código → desenho validado. Na ausência de evidência, mostrar `—`.
