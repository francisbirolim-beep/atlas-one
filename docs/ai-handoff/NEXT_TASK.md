# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Cadastros 360 por usuário

Branch: `feat/cadastros-360-permissoes`

Validar no preview:

1. abrir `/cadastros` como Master e confirmar todos os cards, incluindo Clientes;
2. em `/configuracoes/usuarios`, selecionar um funcionário de teste e deixar somente Clientes marcado em Cadastros 360;
3. entrar com esse funcionário e confirmar que `/cadastros` mostra somente Clientes;
4. restaurar as opções do funcionário após o teste, se necessário;
5. conferir o layout da seleção no celular.

Próxima evolução recomendada: aplicar permissões profundas por rota e ação (`ver`, `criar`, `editar`, `excluir`, `aprovar`) sem criar uma segunda base de usuários ou cadastros.


## TAREFA ATUAL — validar filtro do Kanban por período e tipo de data
## ROTEIRO ACORDADO — Compras 360 mais dinâmico (2026-08-31)

Aprovado pelo usuário em 2026-08-31, a executar em PRs separados, nesta ordem:

1. **PR #291 (feat/compras-360-filtro-categoria)** — filtros de produtos por categoria
   (Perfis, Acessórios, Vidros, Produto pronto, Outros, Todas) + busca por
   nome/código com lista de sugestões clicáveis. Concluído e aprovado pelo
   usuário; aguardando merge.

2. **Vínculo necessidade → Cliente/Obra ou Estoque. CONCLUÍDO (PR #297,
   mesclado em main, migration aplicada em produção em 2026-08-31).**
   Modal "Adicionar necessidade" tem passo "Destino da compra": Cliente/Obra
   (busca cliente, depois lista as obras dele) ou Estoque. Necessidade
   guarda `destino`/`cliente_id`/`cliente_nome`/`obra_id`/`obra_nome`
   estruturados (colunas novas em `compras_necessidades`, migration
   20260831113359). Modal também ganhou uma etapa de confirmação/resumo
   ("Revisar pedido" → mostra material, quantidade, prioridade, prazo,
   destino e observações → "Confirmar e enviar pedido") antes de gravar,
   a pedido do usuário. Erros de gravação aparecem dentro do próprio modal
   (antes ficavam escondidos atrás dele).

3. **Fornecedor 360 — CONCLUÍDO (2026-08-31, PRs #298, #299, #300).**
   Espelhando o Cliente 360, do lado do fornecedor. Entregue:
   - Cadastro de fornecedor com **pedido mínimo** e **prazo de entrega**
     (migration 20260831150000).
   - Página **Fornecedor 360** (`/fornecedores/[id]`): dados do fornecedor,
     cotações pendentes, "falta R$X pro pedido mínimo" e histórico de
     compras recebidas (produto, categoria, preço, data).
   - **Kanban de aprovação do comprador** dentro do Compras 360 existente:
     seção "Fornecedores para cotar" no card da necessidade — o comprador
     marca os fornecedores possíveis e "Convidar para cotação" cria, em
     lote, uma linha de cotação por fornecedor (`preco_unitario` aceita
     nulo — migration 20260831190000 — até o preço chegar), avançando a
     necessidade para a coluna de cotação automaticamente.
   - No formulário de cotação: ao escolher um fornecedor, se ele vendeu
     esse mesmo item da última vez, o **preço já vem sugerido**; e um
     aviso mostra quanto falta (ou se já bateu) o **pedido mínimo** desse
     fornecedor, somando as cotações pendentes dele em todas as
     necessidades abertas.

   Nada pendente deste item. Próxima frente do Compras 360 fica em aberto
   — decidir com o usuário antes de iniciar.

Fluxo final desejado pelo usuário: necessidade pendente → aprovação do
comprador (kanban) → cotação separada por fornecedor → comprado aguardando
chegar, com o cliente/obra sempre rastreado (já entregue na etapa 2), e o
fornecedor também totalmente rastreado com tudo que já foi comprado dele,
pedido mínimo e prazo de entrega facilitando a decisão de quando comprar.

---

## TAREFA ATUAL — validar e publicar Compras 360

Branch: `fix/compras-360-main`

### Validar no preview

1. no modal de nova necessidade, alternar entre **Todos, Perfis, Acessórios, Vidros, Produto pronto e Outros** e confirmar que a lista de produto cadastrado muda conforme o filtro;
2. criar uma necessidade com produto cadastrado e outra digitada manualmente;
3. abrir a necessidade, incluir cotações de dois fornecedores e comparar total, prazo e pagamento;
4. selecionar a cotação vencedora e confirmar que só então a compra pode ser aprovada;
5. avançar por pedido emitido, aguardando entrega e recebido;
6. confirmar que `Recebido` não altera o saldo de estoque;
7. acessar Entrada por NF, Recebimentos e NFs, Itens sem vínculo, Estoque e Contas a pagar pelos atalhos;
8. testar no celular e confirmar que página, cards, modal e tabela não estouram horizontalmente;
9. confirmar Build Validation, Vercel e Supabase Database Control antes do merge.

### Publicação

- integrar somente após todas as verificações automáticas e o preview estarem aprovados;
- após o merge, conferir `/compras` no domínio normal do Atlas e realizar uma necessidade de teste controlada.

---

## TAREFA ATUAL — validar menu mobile claro

Branch: `feat/mobile-menu-claro`

### Validar no preview

1. abrir o menu completo no iPhone e confirmar o fundo branco;
2. conferir contraste de marca, busca, grupos, itens, descrições administrativas e rodapé;
3. navegar para Compras, Estoque, Cadastros e Configurações;
4. pesquisar uma opção e confirmar o estado vazio quando não houver resultado;
5. confirmar que o item da rota atual permanece destacado em azul;
6. validar Francis/master e um funcionário com setores limitados.

### Limite da mudança

- alteração exclusivamente visual da gaveta mobile;
- nenhuma rota, permissão, regra operacional, migration ou dado alterado.

---

## TAREFA ATUAL — validar correção global de largura no celular

Branch: `feat/mobile-navigation-v2`

### Validar no preview

1. abrir Home, Compras, Estoque, Cadastros e Configurações no celular;
2. tentar arrastar a página para os lados e confirmar que o conteúdo permanece preso ao viewport;
3. conferir que títulos, descrições, cards e campos quebram linha sem cortar o início ou o final;
4. em Estoque e demais telas com tabelas largas, confirmar que somente a tabela possui rolagem horizontal;
5. confirmar que a barra inferior e a gaveta de navegação continuam funcionando normalmente;
6. validar em iPhone instalado e também no navegador móvel.

### Estado técnico

- correção implementada sem alteração de dados ou regras operacionais;
- build completo aprovado, incluindo TypeScript e geração das 90 rotas;
- próximo passo: atualizar o preview da branch e validar visualmente no aparelho real.

---

## TAREFA ATUAL — validar navegação completa no celular

Branch: `feat/mobile-navigation-v2`

Dependência visual: `feat/atlas-visual-v2` / PR #284.

### Validar no preview

1. confirmar que a barra inferior não cobre cards, botões ou campos;
2. abrir **Menu** e conferir os grupos Geral, Comercial, Operações e Administração;
3. pesquisar `compras`, `estoque`, `cadastros` e `configurações`;
4. abrir um módulo e confirmar que a gaveta fecha automaticamente;
5. abrir Favoritos pela barra inferior e confirmar que o botão flutuante antigo não aparece;
6. validar a área segura inferior no iPhone instalado e no navegador;
7. entrar com usuário master e confirmar Administração completa;
8. entrar com funcionário limitado e confirmar que setores ocultos não aparecem.

### Ordem de integração

- primeiro validar e integrar o PR #284;
- depois retargetar esta branch para `main`, validar o diff isolado e integrar manualmente;
- não misturar correções funcionais de Compras, Estoque ou permissões neste PR visual de navegação.

---

## TAREFA ATUAL — validar Atlas Visual V2

Branch: `feat/atlas-visual-v2`

Objetivo: confirmar a nova identidade visual do Atlas antes de expandi-la para o conteúdo interno de cada módulo.

### Validar no preview

1. abrir a Home no computador e confirmar sidebar, cabeçalho, atalhos e indicadores;
2. abrir no celular e confirmar que o cabeçalho não comprime o título e que os atalhos aparecem em duas colunas;
3. confirmar que o placeholder de logo não ocupa espaço no celular quando a empresa ainda não tem logo cadastrado;
4. confirmar que não existe rolagem horizontal indevida;
5. testar busca global, notificações e menu do usuário;
6. navegar por Clientes, Orçamentos, Kanban, Compras, Estoque, Produção e Engenharia;
7. conferir tema claro/escuro por usuário;
8. confirmar que nenhuma ação operacional ou permissão mudou.

### Próxima etapa depois da aprovação

- aplicar os mesmos componentes de cabeçalho, métricas, abas, filtros e tabelas aos módulos antigos;
- migrar um módulo por PR para reduzir risco e permitir validação visual gradual;
- manter os módulos 360 e a Home como referência oficial do design.

---

## TAREFA ANTERIOR — validar filtro do Kanban por período e tipo de data

Branch: `feat/kanban-filtro-periodo-datas`

Objetivo: permitir consultar cards por intervalo inclusivo de datas, escolhendo entre a data fixa de entrada no Kanban e a data da última movimentação da coluna.## TAREFA ATUAL — validar Preview do PR #280

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge ainda.**

O objetivo agora é testar o fluxo real no Preview antes de continuar expandindo.
## 0. Novo Orçamento — validar primeiro
1. Abrir `/orcamento/novo`.
2. Confirmar os três cards no topo: `Orçamento Obra`, `Novo Orçamento Sob Medida`, `Venda Balcão`.
3. Em `Orçamento Obra`, deixar `Categoria: Todas` e `Linha: Todas` e confirmar que o catálogo mostra as 122 tipologias ativas.
4. Conferir categorias além de Porta/Janela: Painéis/Ripados, Fachadas/Pele de Vidro, ACM, Guarda-corpos/Corrimãos, Portões/Grades, Vidros, Boxes, Espelhos, Coberturas/Clarabóias, Módulos Fixos, Contramarcos/Arremates e Tela Mosquiteira.
5. Pesquisar por texto e confirmar filtro em tempo real.
6. Filtrar por categoria e por linha separadamente.
7. Selecionar uma tipologia e continuar para o formulário.
8. Testar `Novo Orçamento Sob Medida` abrindo diretamente o formulário.
9. Testar `Venda Balcão` e confirmar que segue fora do Kanban de obra.

1. seletor `Data: entrada no Kanban` / `Data: última movimentação`;
2. campos `De` e `Até`, ambos opcionais e inclusivos;
3. correção automática de intervalo invertido;
4. filtro de entrada baseado em `kanban_entrada_em`, com fallback legado para `created_at`;
5. filtro de movimentação baseado em `coluna_atualizada_em`;
6. data de entrada renderizada diretamente no card React;
7. removida a segunda consulta ao Supabase usada apenas para injetar datas no DOM;
8. consulta do Kanban exclui explicitamente registros de balcão sem eliminar registros legados com `modo_entrada` nulo;
9. `OrcamentoRapido` tipado com `kanban_entrada_em`;
10. build completo local aprovado.

### Validação técnica concluída

- PR #281 aberto para `main`;
- Build Validation #643 concluído com sucesso;
- Preview Vercel em estado `READY`;
- diff remoto contém somente os seis arquivos esperados;
- próximo passo: merge manual e confirmação do deploy de produção.

### Validação funcional no preview## Checklist de validação manual

### 1. Precificação do orçamento
1. Abrir `/orcamento/precificacao`.
2. Escolher um orçamento real com itens estruturados e tipologias cadastradas.
3. Gerar a base de precificação.
4. Conferir Perfis, Acessórios, Vidros e pendências.
5. Conferir plano de barras e aproveitamento.
6. Alterar margem geral.
7. Alterar margem somente de um item e confirmar que os demais herdam a geral.
8. Ativar/desativar cobrança de sobra geral e individual.
9. Confirmar que sobra cobrada entra a custo, sem margem.
10. Alterar custo de um componente só neste orçamento.
11. Testar `Salvar no catálogo` e confirmar reaproveitamento em nova geração.
12. Incluir custo extra (ex.: instalação/frete) e conferir preço final.

### 2. Alteração de componente / Tipologia
1. Em Precificação, trocar um perfil/acessório somente neste orçamento.
2. Regerar e confirmar que a tipologia mestre não mudou.
3. Como master, testar alteração definitiva em uma tipologia de teste.
4. Abrir `/engenharia/historico-tipologias`.
5. Confirmar nova versão.
6. Restaurar uma versão anterior e confirmar que nasce outra versão, sem apagar histórico.
7. Duplicar uma tipologia e confirmar que a original permanece intacta.

### 3. Projeto conferido → Materiais
1. Confirmar uma venda controlada.
2. Conferir Financeiro + Conferir Projeto e nenhum downstream precoce.
3. Mover para `Projeto conferido`.
4. Confirmar Medição Final + Perfis + Acessórios + Outros.
5. Confirmar que um pacote técnico é gerado/está disponível para a obra.
6. Vidros ainda não devem estar liberados antes da Medição aprovada.

### 4. Materiais / Estoque da Obra
1. Abrir Obra → `Materiais / Estoque`.
2. Conferir Necessidade técnica.
3. Conferir Plano de barras.
4. Separar uma barra inteira disponível.
5. Reservar um retalho/sobra compatível.
6. Recalcular e conferir redução da compra.
7. Desfazer uma separação e confirmar retorno da disponibilidade.
8. Ajustar quantidade final de compra com justificativa.
9. Incluir/remover material manual e conferir histórico/motivo.
10. Marcar pacote conferido somente após revisão.

### 5. Medição / Vidros / Produção
1. Aprovar Medição Final.
2. Confirmar Vidros + MEE.
3. Conferir ordens de Produção vinculadas.
4. Confirmar que esquadria continua bloqueada enquanto Perfis/Acessórios/Outros não estiverem `Liberado`.
5. Liberar os três setores de materiais.
6. Confirmar que Produção é liberada somente com Medição aprovada.
7. Avançar ordens por `Em produção → Conferência → Concluída`.
8. Confirmar que o card de Produção acompanha as ordens e rejeita movimento manual incompatível.
### 6. Instalação
1. Com todas as ordens concluídas, deixar Vidros ainda não liberados e confirmar que Instalação não nasce.
2. Mover Vidros para `Liberado`.
3. Confirmar criação/liberação da Instalação.
4. Validar `Agendada → Em instalação → Concluída`.
5. Confirmar fechamento da Obra ao concluir Instalação.

- confirmar que `De` sozinho traz a data inicial e posteriores;
- confirmar que `Até` sozinho traz a data final e anteriores;
- confirmar que `De` + `Até` inclui os dois dias limites;
- alternar para `Data: última movimentação` e confirmar que o conjunto muda conforme `coluna_atualizada_em`;
- conferir o layout em largura de celular;
- confirmar que a linha `📅 Entrada` continua abaixo da descrição e antes do vendedor/valor;
- confirmar que nenhum orçamento/venda de balcão aparece;
- usar `Limpar filtros` e confirmar retorno ao padrão de data de entrada.

## Próximo passo recomendado depois desta validação

Adicionar indicadores/resumo do período filtrado somente se houver necessidade operacional validada, sem misturar novamente entrada e movimentação.

## W.Vetro

PR #306 (não mexer) corrigiu a carga travar em dia com erro; foi retomada e está
`em_andamento`. Nova auditoria/tela feita em 2026-09-01 (ver
`docs/ai-handoff/WVETRO_AUDITORIA_BASE_TECNICA_2026-09-01.md` para a versão
anterior à retomada). Estado após retomada:
- 664 dias processados (de ~975), 13 dias em pendência auditável;
- composição por tipologia: 504 linhas em `wvetro_tipologia_componentes` (264
  vinculadas a produto Atlas), mas só 17 das 111 tipologias-referência têm
  alguma composição — ainda é o gargalo para o Orçamento Sob Medida;
- 34 tipologias com imagem, 2 receitas técnicas oficiais já ativas.
- Nova tela `/configuracoes/integracoes/wvetro/base-tecnica/tipologias` (lista) e
  `/tipologias/[id]` (detalhe) para auditar tipologia por tipologia: composição,
  vínculos, variáveis e status de receita oficial. Só leitura, PR
  `feat/wvetro-explorador-tipologias-v1` aguardando Preview/merge.

**Não executar novamente a auditoria inteira sem necessidade — quando a carga
concluir, reauditar via a nova tela em vez de rodar SQL solto.**

## Pontos a observar durante o teste

- fórmula não validada deve gerar pendência, nunca material inventado;
- tamanho de barra deve usar o cadastro operacional normalizado;
- compra deve refletir estoque/separações, não apenas necessidade bruta;
- comprado ≠ consumido;
- reprocessamento não deve duplicar cards/tarefas/notificações/ordens;
- alterações pós-venda relevantes exigem justificativa e histórico;
- Balcão rápido continua fora do workflow de obra.

## Próximas implementações após validação

- completar custos `Previsto → Otimizado → Comprado → Realizado` por obra/item/categoria;
- ligar NF/Compras ao custo comprado da obra;
- ligar consumo de estoque, perdas, devoluções e sobras ao custo realizado;
- dashboard de margem realizada no Cliente 360/Obra;
- interface completa de revisão pós-venda e seus ajustes financeiros;
- definir responsáveis dos demais setores no Motor de Automações.
## Regras invioláveis

- não mergear PR #280 antes da aprovação do usuário;
- não criar status duplicado para Cliente 360;
- não liberar Vidros antes da Medição aprovada;
- não liberar Produção sem Medição + Perfis/Acessórios/Outros liberados;
- não criar Instalação sem Produção concluída + Vidros liberados;
- não inventar fórmula/material pendente;
- restauração de tipologia nunca apaga histórico;
- sobra cobrada fica sem margem;
- GitHub continua fonte da verdade.
