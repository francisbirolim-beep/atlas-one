# DECISIONS.md — Atlas One

Decisões técnicas já adotadas. Não reverter/alterar sem necessidade real e sem entender o motivo abaixo.

## Cliente 360 e fluxo operacional da venda — 2026-08-26

O Cliente 360 consolida relacionamento, obras, financeiro, andamento e histórico sem criar uma segunda fonte de estado. O status operacional mostrado no cliente deve ser derivado dos cards reais dos setores por `cliente_id` e `obra_id`.

Fluxo oficial da venda sob medida:
- **Venda confirmada** cria apenas snapshot da venda, Financeiro e `Engenharia — Conferir Projeto`;
- `Conferir Projeto` é o portão técnico pré-medição para revisar tipologia, montagem, perfis, acessórios e demais definições;
- **Projeto conferido** cria Medição Final + Perfis + Acessórios + Outros;
- **Vidros só nascem depois da Medição Final aprovada**;
- a Medição Final aprovada também mantém o MEE/Engenharia técnica pós-medição, que trabalha com as peças/medidas finais;
- não criar Produção ou Instalação diretamente em `Vendido`; seus gates serão definidos separadamente;
- automações do fluxo devem ser idempotentes, sem duplicar venda, conta ou cards.

A venda fechada deve preservar snapshot (`vendas_obras`). Alterações posteriores relevantes não sobrescrevem silenciosamente o original: devem evoluir por revisão/ajuste com justificativa e antes/depois.

Detalhamento: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

## Venda Balcão é um modo do Atlas, não um sistema separado

O Atlas One possui um ambiente operacional próprio de Venda Balcão (`/balcao`), mas ele pertence ao mesmo produto, autenticação e base de dados do Atlas completo.

Regras permanentes:
- não criar banco, cadastro de produto, cadastro de cliente ou estoque duplicado para o PDV;
- Venda Balcão usa os mesmos produtos, clientes, unidades, locais de estoque, compras e financeiro do Atlas;
- `/balcao` usa interface/shell próprio, compacto e focado na operação de balcão;
- deve existir acesso claro `Voltar ao Atlas` para retornar ao ERP completo;
- cadastros e gestões compartilhadas podem abrir as telas completas do Atlas, preservando a mesma fonte de verdade;
- no futuro, planos comerciais podem ocultar módulos do ERP e expor apenas o ambiente PDV, sem duplicar o backend;
- emissão NFC-e/NF-e e demais recursos fiscais devem ser adicionados a esse mesmo núcleo, após definição de provedor e regras fiscais.

Motivo: a Esquadrifácio usa simultaneamente o ERP completo e vendas de balcão. Separar as bases criaria divergência de estoque, preço, cliente, compra e financeiro.

## Workflow de deploy
Nunca commitar direto em main. Sempre: branch nova -> PR -> aguardar build da Vercel no PR (preview) -> merge manual. Motivo: evitar quebrar produção com erro de TypeScript só descoberto no deploy.

## TipoEsquadria: union fixo -> string dinâmica
TipoEsquadria era um union type fixo ('porta_correr' | 'porta_pivotante' | ... | 'outro'). Foi convertido para `export type TipoEsquadria = string` (`lib/tipos.ts`) para permitir tipologias criadas pelo usuário, sem reescrever comparações/atribuições existentes. Não voltar a union fixo.

## Tabela tipologias como fonte da verdade
A lista de tipos de esquadria vive na tabela `tipologias` (`chave`, `label`, `categoria`, `ordem`) e é lida por `lib/tipologias.ts`. Não reintroduzir arrays hardcoded de tipos nas telas.

## Campo categoria em tipologias ainda não altera cálculo automaticamente
A categoria `porta | janela` é salva, mas não deve ser conectada incidentalmente ao cálculo sensível em `lib/calculos.ts` sem validação técnica e casos reais.

## Medição Final no fluxo de venda

A decisão antiga de manter criação exclusivamente manual foi substituída pelo fluxo validado em 2026-08-26.

Regra atual:
- entrar em `Vendido`/confirmar venda **não cria** Medição Final;
- mover `Engenharia — Conferir Projeto` para **Projeto conferido** cria/garante a Medição Final de forma idempotente;
- a tela de Medição Final continua permitindo gestão operacional própria;
- aprovação da Medição Final é o gatilho para Vidros e para a Engenharia/MEE pós-medição.

Não reintroduzir criação de Medição Final diretamente ao entrar em `Vendido`.

## Padrão "cache de módulo + estado do componente" para listas dinâmicas
Quando uma página tem helper fora do componente React que precisa ler dados buscados de forma assíncrona, o padrão pode usar variável de módulo atualizada junto do estado, preservando comportamento existente.

## RLS aberto (`using true / with check true`)
As tabelas operacionais usam atualmente RLS permissiva para usuários autenticados em vários pontos. É decisão pragmática do estágio atual do app interno. Não assumir que isso representa isolamento forte por usuário; hardening deve ser mudança deliberada em PR separado.

## Migrations devem ser versionadas no repositório
Há dívida técnica histórica de migrations antigas aplicadas direto no banco. Para mudanças novas, preferir sempre `apply_migration` + arquivo correspondente em `supabase/migrations/` no mesmo PR.

## Plano de Corte: produto + receita mestre + variáveis + snapshot
O Plano de Corte não pode ser tratado como fórmula única por tipologia genérica. O produto cadastrado é o ponto de entrada operacional e a receita considera variáveis que alteram geometria/componentes.

Regras permanentes:
- selecionar produto cadastrado primeiro;
- receita mestre define componentes, variantes e fórmulas validadas;
- variáveis escolhem a variante correta;
- plano de produção é snapshot editável da receita naquele momento;
- alterar snapshot não altera silenciosamente receita mestre;
- somente usuário autorizado altera plano;
- fórmula sem evidência suficiente permanece pendente, nunca inventada.

## Identidade técnica de Produto: `dados_origem` como jsonb
`produtos.dados_origem` preserva proveniência sem tabela histórica complexa nesta fase. Nunca rotular valor legado/default como dado cru W.Vetro.

Regras:
- importação externa nova/reconciliada guarda valores crus reais;
- legado não reconciliado deve identificar explicitamente que é snapshot Atlas legado;
- não fingir proveniência W.Vetro;
- evoluir para tabela dedicada se múltiplas versões por produto forem necessárias.

## Identidade técnica de Produto: origem legado até confirmação
Formato `CÓDIGO - DESCRIÇÃO` não prova origem externa. `origem = wvetro` só pode ser usado com correspondência real de fonte. `id_externo_wvetro` recebe chave externa real, nunca substituto inventado.

## Unidade operacional x unidade de origem
`produtos.unidade` é unidade operacional/canônica. `unidade_origem` e `qtde_embalagem_origem` preservam proveniência e não sobrescrevem automaticamente a unidade operacional.

## Identidade técnica de Produto: código não substitui nome
`produtos.codigo`/`codigo_origem` complementam, mas `nome` continua fonte visual usada em várias telas. Não remover código do nome legado sem refatorar todas as dependências.

## Identidade técnica de Produto: unique index em código só com auditoria
A unicidade case-insensitive de código foi criada depois de auditoria de duplicidades. Futuras colisões devem ser revisadas como dado, não contornadas silenciosamente.

## NCM: nunca inferir "válido" automaticamente
NCM só é marcado inválido quando inequivocamente placeholder. O fato de ter oito dígitos não prova validade fiscal. Peso fora de faixa plausível é sinalizado, não apagado.

## Produtos — unidade operacional pendente
`produtos.unidade = NULL` significa unidade operacional ainda não definida. Não significa `UN` e não autoriza copiar `unidade_origem`. Produtos sem unidade operacional validada não devem entrar em fluxos que exijam unidade definida.
