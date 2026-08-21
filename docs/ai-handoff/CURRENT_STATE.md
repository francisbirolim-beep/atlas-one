# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — PLANO DE CORTE V4 COM PERFIS — 2026-08-20

Branch `fix/plano-corte-perfis-v4`, PR #216.

Objetivo desta etapa: fazer o relatório de `/engenharia/formulas-corte` seguir o protótipo `Plano_de_Corte_Atlas_Rascunho_v4.pdf`, principalmente a tabela `FIG. | CÓDIGO | DESCRIÇÃO | CORTE | QTDE. | POS. | PESO`.

Implementado, sem migration e sem alteração de banco:
- `lib/planoCortePerfis.ts` enriquece o resultado do motor com cadastro real de `produtos` (`codigo`, `nome`, `foto_url`, `peso_kg_m`);
- `produtos.foto_url` é a fonte prioritária de imagem quando existir;
- fallback de desenho técnico estático existe somente para códigos PC3 auditados a partir do manual técnico Suprema/W.Vetro: SU010, TMC, SU012, SU008, SU280, SU243, SU242, SU053, SU225 e SU102;
- o grupo abstrato `travessas` do motor é apresentado no relatório PC3 como SU053, SU225 e SU102 horizontal;
- `SU102(H)` é apresentado como código real SU102 com posição H;
- quantidades/posições do PC3 usam evidência repetida de orientativos reais W.Vetro; não são propagadas para outras tipologias;
- peso por linha = `peso_kg_m cadastrado × corte em metros × quantidade`;
- peso total da esquadria só aparece quando todas as linhas possuem peso calculável;
- a ordem visual do PC3 segue o orientativo: marcos → travessas → montantes → mão-de-amigo → baguetes;
- qualquer dado técnico ausente permanece `—`.

### PC3 Suprema — quantidades validadas nesta etapa
- SU010: 1, posição L;
- TMC: 3, posição L;
- SU012: 2, posição H;
- SU008: 2, posição H;
- SU053: 3, posição L;
- SU225: 3, posição L;
- SU280: 2, posição H;
- mão-de-amigo interno/externo resolvido pela fórmula: 2 de cada, posição H;
- SU102: 6 horizontal e 6 vertical.

### Governança
- GitHub é a única fonte da verdade;
- nunca commitar direto em `main`;
- branch → PR → Build Validation verde + Vercel Preview verde → merge;
- migrations somente com autorização explícita e específica;
- não inferir imagem, perfil, quantidade, peso, receita ou vínculo por semelhança;
- fora do PC3 Suprema, o relatório não deve assumir quantidades/pesos até validação específica.

## CONTEXTO RECENTE

- PR #215: Plano de Corte V4 com modos `Vinculado à obra / medição final` e `Plano manual`, campos de cliente/obra/orçamento/item/localização/status da medição/medidas/cores/vidro/observações; produção READY.
- PR #214: primeira versão imprimível do Plano de Corte.
- PR #213: navegação própria da Engenharia com atalho para Fórmulas de Corte.
- PR #211: interface real ligada ao motor e Supabase.
- PR #210: `lib/formulasCorteEngine.ts`, parser seguro sem `eval`/`Function()`.
- migration `engenharia_formulas_corte_v1` aplicada em produção com autorização explícita; 1 seed PC3, 3 variáveis e 11 definições de peças/grupos.
- pendência de governança anterior: `20260819150000_engenharia_campos_corte_preset_v1.sql` não consta no histórico remoto embora a coluna exista fisicamente; não corrigir por suposição.
