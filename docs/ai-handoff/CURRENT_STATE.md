# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Nao assuma que algo esta implementado so porque aparece em documentacao. Antes de alterar codigo, verifique o estado real do repositorio (arquivos em lib/ e app/, tabelas no Supabase). Ao concluir uma implementacao relevante, atualize este arquivo, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, direto no codigo da branch feat/confirmacao-venda.

## FUNCIONANDO (validado em producao)
- Login/autenticacao e controle de usuario Master/funcionario.
- Kanban de orcamentos com colunas dinamicas, drag-and-drop e historico.
- Cadastro de clientes, fornecedores, produtos.
- Orcamento rapido e orcamento balcao.
- Checklist de medicao final por tipologia (numero/texto/foto, obrigatorio).
- Medicao final: medir/reabrir item.
- Tipologias dinamicas (PR #28).
- Automacoes de setor e tarefas.
- Exclusao de Medicao Final pelo Master e limpeza de cards derivados por orcamento.
- Importacao de itens via PDF existe no codigo, mas a leitura de PDFs reais W.Vetro ainda nao e confiavel para todos os layouts.

## IMPLEMENTADO MAS NAO VALIDADO
- Nova arquitetura de Confirmacao de Venda (branch feat/confirmacao-venda):
  - entrar em coluna com gera_medicao_final=true deixa de criar Medicao Final/cards operacionais automaticamente;
  - abre /vendas/confirmar?orcamento=<id>;
  - exige cadastro completo do cliente;
  - lista os orcamentos do mesmo cliente para escolher qual foi fechado;
  - mostra anexos e itens estruturados;
  - botao "Iniciar processo da venda" cria a Medicao Final e dispara automacoes somente depois da confirmacao;
  - se o orcamento nao possui itens estruturados no Atlas, o processo e bloqueado.
- Modulo de IA/agente: existe mas nao auditado a fundo.
- CRM: presente no codigo, uso real nao confirmado nesta sessao.

## PARCIAL
- Conversao de PDF W.Vetro em Orçamento Atlas estruturado: parser existe, mas ainda falha em alguns PDFs reais. A nova Confirmacao de Venda foi desenhada para bloquear o processo ate existir uma lista de itens confiavel.
- Modelo conceitual futuro Venda/Obra: decidido, mas ainda nao existe uma tabela `vendas`/`obras`. Na Fase 1 a confirmacao usa o proprio orcamento selecionado como referencia.

## NAO IMPLEMENTADO
- Entidade persistente `vendas` ou `obras` para separar cliente/orcamento/venda fechada.
- Tela de conferencia/edicao da importacao PDF W.Vetro -> Orçamento Atlas antes de iniciar o processo.
- Geracao completa do novo PDF de orçamento com identidade Atlas como saida oficial do orçamento estruturado.
- Testes automatizados.

## PROBLEMAS CONHECIDOS
- Migrations v16-v19 foram aplicadas diretamente no banco e nao possuem arquivos SQL versionados. NAO reaplicar automaticamente no banco atual.
- lib/calculos.ts ainda nao usa categoria dinamica de tipologia para formulas porta/janela.
- Parser de PDF e heuristico e nao deve ser tratado como fonte unica para liberar producao/medicao sem conferencia.
