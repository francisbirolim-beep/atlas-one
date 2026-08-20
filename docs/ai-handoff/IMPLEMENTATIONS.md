# IMPLEMENTATIONS.md — Atlas One

## 2026-08-20 — Plano de Corte imprimível V1 — EM VALIDAÇÃO

Referência visual: orientativo real do W.Vetro do orçamento #994 enviado pelo Francis.

Implementado em `app/engenharia/formulas-corte/page.tsx`, sem migration e sem alteração de banco:
- campos manuais de cliente, obra, projeto/configuração, cor de perfil, cor de acessório e vidro;
- geração do plano continua usando exclusivamente `calcularFormulasCorte` e as definições reais do Supabase;
- relatório visual com cabeçalho, tipologia, medidas, tabela de perfis/cortes e variáveis;
- botão `Imprimir / Salvar PDF` com impressão A4 isolada do restante da interface;
- nenhum dado de quantidade, peso, desenho individual de perfil ou lista de vidro é inventado. Esses itens ficam para a próxima etapa, após modelagem estruturada e validação real.

## 2026-08-20 — interface de validação das fórmulas de corte PC3

Pré-requisitos concluídos:
- PR #210 mergeada com `lib/formulasCorteEngine.ts`;
- migration `engenharia_formulas_corte_v1` aplicada em produção;
- PR #211 ligou o motor ao Supabase e à tela `/engenharia/formulas-corte`;
- PR #213 adicionou navegação própria no setor Engenharia.

## 2026-08-20 — motor declarativo de fórmulas de corte PC3 — PR #210

Implementado:
- parser aritmético restrito, sem `eval` e sem `Function()`;
- condições por variável, referências entre peças e `ROUND()`;
- resolução explícita de dependências e erros.

Referência W.Vetro #994, 3000 x 2500 sem contramarco / mão-de-amigo comum:
- SU010 = 2970;
- SU012 = 2496;
- SU008 = 2483;
- SU280 = 2466;
- SU102(H) = 2315;
- travessas = 938.

## 2026-08-19 — Campos de Corte por Perfil — PR #209

Migration `20260819150000_engenharia_campos_corte_preset_v1.sql` adicionou `campos_corte jsonb` em `engenharia_variaveis_preset`. A coluna existe fisicamente em produção, embora essa versão não apareça no histórico remoto atual do Supabase; tratar essa divergência em tarefa separada.
