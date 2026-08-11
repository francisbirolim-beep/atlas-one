# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes, da mais antiga para a mais recente. Para detalhes de arquitetura ver ARCHITECTURE.md; para o que esta funcionando de fato ver CURRENT_STATE.md.

## Cadastro base (clientes, produtos, fornecedores)
Objetivo: cadastro completo de clientes (com endereco/contato), produtos (com fornecedor, precos) e fornecedores. Status: concluido. Arquivos: app/clientes/*, app/cadastro/*, lib/clientes.ts, lib/produtos.ts, lib/fornecedores.ts, migrations v12/v14/v15.

## Kanban de orcamentos
Objetivo: quadro kanban para acompanhar orcamentos por coluna (Fazer orcamento -> Orcamento feito -> Enviado -> Vendido), com automacoes de setor (fan-out) e automacoes de tarefa. Status: concluido e em uso. Arquivos: app/kanban/page.tsx, lib/kanban.ts, lib/automacoes.ts, lib/automacoesSetor.ts.

## Medicao Final (fase inicial)
Objetivo: apos orcamento vendido, permitir medir cada esquadria fisicamente, com colunas proprias, checklist de campos extra por tipologia. Status: concluido. Arquivos: app/producao/medicao-final/*, lib/medicaoFinal.ts, migration v13.

## Importacao de itens via PDF
Objetivo: ler PDF de orcamento e gerar itens de medicao automaticamente. Status: concluido. Arquivos: lib/pdfOrcamentoImport.ts, app/api/importar-itens-orcamento/route.ts.

## Checklist de medicao: campo obrigatorio
Objetivo: permitir marcar campos do checklist como obrigatorios, bloqueando salvar sem preencher. Status: concluido e mergeado. Arquivos: lib/tipos.ts, lib/medicaoFinal.ts, app/configuracoes/page.tsx, app/producao/medicao-final/[id]/page.tsx. Migration: coluna obrigatorio em tipologia_campos_extras.

## Redesign do checklist em Configuracoes
Objetivo: corrigir bug de UX onde o usuario nao conseguia adicionar campos ao checklist (formulario unico + erros nao mostrados). Trocado por selecao de tipologia via chips + formulario dedicado por grupo. Status: concluido e mergeado.

## Campo tipo "foto" no checklist + fluxo de finalizar medicao
Objetivo: permitir campos do tipo foto (upload/camera) no checklist, e um fluxo de "medido" com checkmark e opcao de reabrir para editar. Descoberta durante a implementacao: o fluxo de "finalizar + checkmark" ja existia (medido/medido_em/medido_por em medicao_itens) — so faltava mesmo o tipo foto. Status: concluido e mergeado. Arquivos: lib/tipos.ts (TipoValorCampoExtra inclui 'foto'), lib/upload.ts (uploadFoto), app/producao/medicao-final/[id]/page.tsx, app/configuracoes/page.tsx.

## Tipologias dinamicas (PR #28)
Objetivo: permitir criar novas tipologias (alem das 10 fixas) direto na tela de Configuracoes, funcionando em todo o sistema (kanban, orcamento, medicao). Status: concluido e mergeado em main. Principais mudancas: tabela tipologias (migration aplicada direto no banco, nao commitada como .sql — ver DECISIONS.md), lib/tipologias.ts (CRUD), TipoEsquadria virou string dinamica (lib/tipos.ts), botao "Adicionar tipologia" em Configuracoes, e as 5 telas que tinham array fixo de tipos passaram a buscar de listarTipologias(): app/kanban/page.tsx, app/orcamento-rapido/page.tsx, app/producao/medicao-final/page.tsx, app/producao/medicao-final/[id]/page.tsx, app/configuracoes/page.tsx. Limitacao conhecida: campo categoria (porta/janela) da tipologia nova nao esta conectado a lib/calculos.ts ainda (ver DECISIONS.md).

## Automacao Vendido -> Medicao Final (EM ABERTO)
Objetivo: quando um card entra numa coluna com gera_medicao_final=true, criar automaticamente o registro em medicoes_finais (hoje e manual). Status: NAO IMPLEMENTADO. Plano definido, nao commitado — ver NEXT_TASK.md para detalhes tecnicos e proximo passo.
