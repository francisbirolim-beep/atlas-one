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

A Home e o App Shell ja foram modernizados. A branch `feat/atlas-shell-definitivo-v2` aplica essa identidade tambem na Medicao Final.

### Implementado na Medicao Final V2 nesta branch
- quadro `/producao/medicao-final` com visual ERP e melhor responsividade;
- detalhe `/producao/medicao-final/[id]` otimizado para celular;
- progresso operacional por quantidade real de pecas;
- identificacao dos medidores a partir dos itens ja concluidos;
- alerta quando uma linha ainda representa varias unidades;
- acao explicita para separar unidades NAO medidas em pecas individuais, preservando itens ja medidos para revisao humana;
- nenhuma migration ou alteracao automatica destrutiva foi adicionada.

### Proxima tarefa da Medicao Final V2
Evoluir o modelo funcional de forma pequena e versionada:
1. definir/persistir responsavel da Medicao Final no nivel da obra, e nao apenas por item;
2. criar estrutura de pendencias por peca;
3. ampliar checklist dinamico com respostas Sim / Nao / Nao se aplica e regras condicionais;
4. fotos categorizadas por peca;
5. fluxo `aguardando -> liberado -> iniciado -> concluido -> revisao -> aprovado -> engenharia`;
6. depois disso, criar acesso externo por token seguro e escopo somente da medicao.

IMPORTANTE: essas proximas etapas exigem schema persistente novo. Criar migrations versionadas no repositorio; nao repetir a divida tecnica das migrations v16-v19.

## Evolucao de arquitetura depois da Fase 2
Criar entidade persistente `vendas` ou `obras`, separando:
`cliente -> orcamentos -> venda/obra -> medicao final -> engenharia -> producao -> instalacao`.

## Cuidados
- Repositorio GitHub continua sendo a fonte da verdade.
- Nunca commitar direto em main; sempre branch -> PR -> Vercel -> merge manual.
- Migrations v16-v19 seguem desalinhadas; nao reaplicar no banco atual.
- Nao voltar a criar processos operacionais diretamente no drag-and-drop de Vendido.
- Nao reinterpretar automaticamente dados de medicao ja concluidos.
