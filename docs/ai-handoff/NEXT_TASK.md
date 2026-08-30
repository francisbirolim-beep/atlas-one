# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar porta de entrada Cliente 360

Branch: `feat/orcamento-cliente-minimo`

1. abrir **Novo orçamento**, pesquisar um cliente existente e confirmar que a ficha Cliente 360 abre;
2. pesquisar cliente inexistente, informar nome e sobrenome e confirmar criação/abertura da ficha;
3. na ficha, abrir **Pedido de orçamento**, **Orçamento sob medida**, **Orçamento balcão** e **Assistência** e conferir o vínculo ao mesmo cliente;
4. tentar salvar orçamento sob medida com somente primeiro nome e confirmar o bloqueio;
5. tentar finalizar venda balcão sem cliente ou sem telefone/WhatsApp e confirmar o bloqueio;
6. confirmar que o cadastro permite salvar somente com nome e sobrenome e que a venda balcão ainda bloqueia a finalização sem telefone/WhatsApp;
7. aguardar Build Validation e preview Vercel antes de merge.
8. criar duas obras/locais no mesmo Cliente 360; iniciar um orçamento e uma assistência por cada cartão e confirmar que o histórico mostra o local certo;
9. no orçamento, testar escolher uma obra existente e cadastrar uma obra nova pelo seletor azul; confirmar que uma obra de outro cliente não é aceita pelo servidor.
10. na identificação, digitar parte do nome de um cliente já cadastrado e confirmar que ele aparece imediatamente abaixo do campo.

---

## TAREFA ATUAL — validar e publicar Compras 360

Branch: `fix/compras-360-main`

### Validar no preview

1. criar uma necessidade com produto cadastrado e outra digitada manualmente;
2. abrir a necessidade, incluir cotações de dois fornecedores e comparar total, prazo e pagamento;
3. selecionar a cotação vencedora e confirmar que só então a compra pode ser aprovada;
4. avançar por pedido emitido, aguardando entrega e recebido;
5. confirmar que `Recebido` não altera o saldo de estoque;
6. acessar Entrada por NF, Recebimentos e NFs, Itens sem vínculo, Estoque e Contas a pagar pelos atalhos;
7. testar no celular e confirmar que página, cards, modal e tabela não estouram horizontalmente;
8. confirmar Build Validation, Vercel e Supabase Database Control antes do merge.

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

Objetivo: permitir consultar cards por intervalo inclusivo de datas, escolhendo entre a data fixa de entrada no Kanban e a data da última movimentação da coluna.

### Implementado

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

### Validação funcional no preview

Em `/kanban`:

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

Auditoria histórica completa encerrada. **Não executar novamente a auditoria inteira sem necessidade.**

Resumo preservado:
- 1.307 perfis;
- 1.174 acessórios;
- 111 tipologias referência, 109 mapeadas;
- 119 linhas referência;
- 1.529 perfis históricos;
- 1.294 acessórios históricos;
- 14 vidros referência;
- 2.481 produtos consultados;
- 1.287 imagens copiadas.

## Regras invioláveis

- GitHub é a fonte da verdade.
- Branch → PR → build/preview → merge; nunca commit direto em `main`.
- Venda Balcão e Atlas completo compartilham produtos, clientes, estoque, compras e financeiro; tabelas transacionais próprias do PDV podem existir no mesmo banco para isolar fluxos.
- Venda/Orçamento Balcão rápido não alimenta o Kanban; orçamento sob medida/obra alimenta.
- `kanban_entrada_em` é fixa; `coluna_atualizada_em` é movimentação/SLA.
- Busca operacional dos principais cadastros deve seguir o padrão Atlas V1.
- Não inventar custo, preço, margem ou unidade comercial a partir de referência W.Vetro.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
