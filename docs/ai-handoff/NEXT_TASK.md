# NEXT_TASK.md — Atlas One

## Tarefa atual
Validar a Fase 1 da nova Confirmacao de Venda.

### Fluxo implementado na branch feat/confirmacao-venda
1. Arrastar um orcamento para uma coluna com `gera_medicao_final=true`.
2. O Atlas move o card, mas NAO cria Medicao Final nem cards de setor automaticamente.
3. O navegador abre `/vendas/confirmar?orcamento=<id>`.
4. A tela exige cadastro completo do cliente.
5. Lista todos os orcamentos vinculados ao mesmo `cliente_id` para escolher qual foi fechado.
6. Mostra anexos e itens estruturados do orcamento selecionado.
7. Se nao houver itens estruturados, bloqueia o inicio do processo.
8. Ao clicar `Iniciar processo da venda`, cria/reutiliza Medicao Final e executa automacoes de setor/tarefa.

## Validacao obrigatoria
- Build da Vercel deve passar.
- Testar cliente com cadastro incompleto: processo precisa ficar bloqueado.
- Salvar cadastro completo e confirmar persistencia no cadastro do cliente.
- Testar cliente com mais de um orcamento e selecionar uma proposta diferente.
- Testar orcamento sem itens estruturados: botao deve ficar bloqueado.
- Testar orcamento com itens estruturados: deve criar Medicao Final apenas apos clicar em Iniciar processo.
- Confirmar que arrastar para Vendido sozinho nao cria mais cards operacionais.

## Proxima fase recomendada — Fase 2
Criar a tela `PDF W.Vetro -> Orçamento Atlas` dentro da Confirmacao de Venda:
- detectar PDF anexado;
- extrair itens;
- montar uma copia estruturada conferivel dentro do Atlas;
- permitir corrigir/adicionar/remover itens antes de confirmar;
- nunca liberar processo com zero itens;
- manter o PDF original como documento de origem;
- futuramente gerar o PDF oficial do Atlas a partir desses dados estruturados.

## Evolucao de arquitetura depois da Fase 2
Criar entidade persistente `vendas` ou `obras`, separando:
`cliente -> orcamentos -> venda/obra -> medicao final -> engenharia -> producao -> instalacao`.

## Cuidados
- Repositorio GitHub continua sendo a fonte da verdade.
- Migrations v16-v19 seguem desalinhadas; nao reaplicar no banco atual.
- Nao voltar a criar processos operacionais diretamente no drag-and-drop de Vendido.
