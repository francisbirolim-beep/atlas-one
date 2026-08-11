# NEXT_TASK.md — Atlas One

## Trilha funcional atual
Validar a Fase 1 da nova Confirmacao de Venda e, na sequencia, criar a Fase 2 `PDF W.Vetro -> Orçamento Atlas` conferivel.

### Fluxo de Confirmacao de Venda
1. Arrastar um orcamento para uma coluna com `gera_medicao_final=true`.
2. O Atlas move o card, mas NAO cria Medicao Final nem cards de setor automaticamente.
3. O navegador abre `/vendas/confirmar?orcamento=<id>`.
4. A tela exige cadastro completo do cliente.
5. Lista todos os orcamentos vinculados ao mesmo `cliente_id` para escolher qual foi fechado.
6. Mostra anexos e itens estruturados do orcamento selecionado.
7. Se nao houver itens estruturados, bloqueia o inicio do processo.
8. Ao clicar `Iniciar processo da venda`, cria/reutiliza Medicao Final e executa automacoes de setor/tarefa.

## Validacao funcional obrigatoria
- Build da Vercel deve passar.
- Testar cliente com cadastro incompleto: processo precisa ficar bloqueado.
- Salvar cadastro completo e confirmar persistencia no cadastro do cliente.
- Testar cliente com mais de um orcamento e selecionar uma proposta diferente.
- Testar orcamento sem itens estruturados: botao deve ficar bloqueado.
- Testar orcamento com itens estruturados: deve criar Medicao Final apenas apos clicar em Iniciar processo.
- Confirmar que arrastar para Vendido sozinho nao cria mais cards operacionais.

## Proxima fase funcional — Fase 2
Criar a tela `PDF W.Vetro -> Orçamento Atlas` dentro da Confirmacao de Venda:
- detectar PDF anexado;
- extrair itens;
- montar uma copia estruturada conferivel dentro do Atlas;
- permitir corrigir/adicionar/remover itens antes de confirmar;
- nunca liberar processo com zero itens;
- manter o PDF original como documento de origem;
- futuramente gerar o PDF oficial do Atlas a partir desses dados estruturados.

## Trilha visual — Atlas One Definitivo
A identidade escolhida e: ERP industrial moderno + SaaS + operacao + engenharia.

A Home e o App Shell ja foram modernizados. A branch `feat/atlas-shell-definitivo-v2` refina a Topbar e a base global sem alterar regras de negocio.

### Proxima tarefa visual recomendada
Aplicar o Design System ao modulo de Medicao Final em duas etapas pequenas:

1. `/producao/medicao-final`
   - remover cabecalho/gradiente antigo que duplica o App Shell;
   - usar PageHeader/SystemCard/SectionHeader ou componentes equivalentes;
   - transformar o quadro em Kanban operacional mais compacto e legivel;
   - destacar progresso por obra, quantidade de pecas, pendencias e proxima acao;
   - manter drag-and-drop, exclusao Master, configuracao de colunas e criacao de medicao sem mudanca funcional.

2. `/producao/medicao-final/[id]`
   - mobile-first;
   - cabecalho com cliente/obra/progresso;
   - lista de pecas com status;
   - abas Medidas / Checklist / Fotos / Observacoes;
   - botoes grandes e campos numericos adequados para uso em obra;
   - preservar regras atuais de medicao e checklist.

## Evolucao de arquitetura depois da Fase 2
Criar entidade persistente `vendas` ou `obras`, separando:
`cliente -> orcamentos -> venda/obra -> medicao final -> engenharia -> producao -> instalacao`.

## Cuidados
- Repositorio GitHub continua sendo a fonte da verdade.
- Nunca commitar direto em main; sempre branch -> PR -> Vercel -> merge manual.
- Migrations v16-v19 seguem desalinhadas; nao reaplicar no banco atual.
- Nao voltar a criar processos operacionais diretamente no drag-and-drop de Vendido.
- Na trilha visual, nao alterar regras de negocio incidentalmente.
