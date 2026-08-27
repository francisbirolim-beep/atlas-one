# DECISIONS.md — Atlas One

Decisões técnicas já adotadas. Não reverter/alterar sem necessidade real e sem entender o motivo.

## Cliente 360 e fluxo oficial da venda

Cliente 360 consolida relacionamento, Obras, Financeiro e Andamento sem criar uma segunda fonte de status. O estado mostrado deve vir dos processos/cards reais.

Fluxo:
- Venda confirmada → snapshot + Financeiro + Conferir Projeto;
- Projeto conferido → Medição Final + Perfis + Acessórios + Outros + pacote técnico/ordens quando aplicável;
- Medição aprovada → Vidros + MEE;
- Produção só é liberada com Medição aprovada + Perfis/Acessórios/Outros em `Liberado`;
- Instalação só é criada/liberada com todas as ordens concluídas + Vidros em `Liberado`.

Nunca reintroduzir Medição, Produção ou Instalação diretamente em `Vendido`.

## Produção é derivada das ordens

O card de Produção é uma visão agregada das Ordens de Produção. Se existem ordens vinculadas, não permitir arrastar o card para um estado incompatível com elas.

Ordem de esquadria pode ficar bloqueada aguardando gates. Contramarco e esquadria podem ser ordens separadas.

A regra genérica `Materiais liberados → Produção` permanece inativa: o gate técnico das ordens é a fonte da liberação.

## Instalação depende de Produção + Vidro

`Produção concluída → Instalação` está ativa, mas o evento só é disparado quando todas as ordens não canceladas estiverem concluídas e Vidros estiverem `Liberado`.

Instalação: `Agendada → Em instalação → Concluída`. Concluir Instalação conclui a Obra.

## Pacote técnico e materiais

Necessidade técnica, plano de barras, separação, compra e consumo são conceitos diferentes.

Regras:
- fórmula não validada não gera compra automática inventada;
- otimização de orçamento não reserva estoque físico;
- separação física cria vínculo/reserva;
- retalhos reaproveitáveis devem ser rastreados;
- desfazer separação devolve disponibilidade;
- **comprado ≠ consumido**;
- devolução ao estoque/sobra não deve permanecer integralmente como custo realizado da obra.

## Precificação e sobra

Orçamento pode ter margem geral e margem individual por item.

Sobra pode ser cobrada geral ou individualmente. Quando cobrada, entra **somente pelo custo**, sem aplicação da margem comercial.

O orçamento deve preservar seu snapshot de custo/preço; alteração posterior do catálogo não deve reescrever margem histórica de venda fechada.

## Alteração de componente: orçamento x tipologia definitiva

Toda alteração deve declarar escopo:
- `orcamento`: override local, sem alterar a tipologia mestre;
- `tipologia_definitiva`: altera a regra técnica mestre, exige usuário master e justificativa.

Alteração definitiva gera nova versão histórica.

## Histórico / restauração de Tipologia

Nunca sobrescrever ou apagar silenciosamente uma versão técnica anterior.

- alteração relevante gera versão;
- restauração cria uma **nova versão** baseada na escolhida;
- duplicação cria tipologia independente em desenvolvimento;
- fórmula complexa que não puder ser trocada com segurança pelo helper simples deve ser encaminhada ao Editor Técnico.

## Venda fechada e revisões

`vendas_obras` preserva snapshot original. Alterações pós-venda relevantes usam revisão com justificativa, antes/depois e impacto. Não sobrescrever silenciosamente venda fechada.

## Venda Balcão é um modo do Atlas

Balcão compartilha produto, cliente, estoque, compras e financeiro com o Atlas, mas o orçamento/venda rápida permanece fora do Kanban/workflow de obra salvo processo sob medida explícito. Não criar base paralela.

## Financeiro único

Cliente e Obra são dimensões da mesma base financeira. Não criar dois financeiros. Recebimento geral pode ser alocado entre obras; recebimento direto de uma obra não deve ser redirecionado a outra.

## Plano de Corte

Plano de Corte = produto + receita mestre + variáveis + snapshot operacional.

- receita/fórmula não validada permanece pendente;
- alterar snapshot de produção não altera silenciosamente a receita mestre;
- fórmulas nunca devem ser inventadas por falta de evidência.

## Tipologias e produtos

- `tipologias` é fonte da verdade para tipos cadastrados;
- `TipoEsquadria` permanece string dinâmica;
- código não substitui nome visual do produto;
- `produtos.unidade = NULL` significa unidade operacional pendente;
- dados de origem/W.Vetro preservam proveniência, mas não substituem regra Atlas validada;
- `tamanho_barra_mm_origem` pode preencher `tamanho_barra_mm` apenas quando o operacional estiver vazio; nunca sobrescrever valor validado.

## RLS e segurança

RLS permissiva em algumas tabelas operacionais é dívida técnica consciente do estágio atual. Hardening deve ser mudança deliberada, não alteração incidental neste PR.

Helpers internos de workflow não devem ficar executáveis diretamente por `anon`/`authenticated`; RPCs de negócio necessárias podem permanecer expostas conforme decisão explícita.

## Migrations

Toda mudança nova de banco deve ser aplicada por migration e versionada em `supabase/migrations/`. Não voltar a aplicar DDL novo apenas no banco sem arquivo correspondente.

## Deploy

Nunca commit direto em `main`.

Fluxo obrigatório:
`branch → PR → Build Validation + Supabase Database Control → Vercel Preview → validação manual → merge manual`.

PR #280 permanece draft até aprovação do usuário.