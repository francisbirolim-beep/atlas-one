# ARCHITECTURE.md — Atlas One

## Stack
- Next.js 14 (App Router), React 18, TypeScript. Sem framework de estado global (useState/useEffect direto nas paginas).
- Tailwind CSS para estilo.
- Supabase (Postgres + Storage) como backend: acesso direto do client via @supabase/supabase-js (lib/supabase.ts), sem camada de API propria na maioria dos casos.
- Poucas API routes em app/api/* (agente de IA, backup/restore, importar PDF, criar/atualizar usuario, resolver-login) — usadas quando e preciso rodar algo no servidor (ex.: chave de service role, parsing de PDF).
- Deploy: Vercel. Cada PR gera preview automatico; merge em main dispara deploy de producao.
- PWA basico (public/manifest.json, public/sw.js, icones).

## Estrutura de diretorios
- app/ — rotas (App Router). Cada pasta = uma tela. Paginas maiores: kanban, producao/medicao-final, orcamento*, configuracoes, cadastro, clientes, crm, historico, assistencia(s).
- app/api/ — rotas server-side (Route Handlers).
- lib/ — toda a logica de acesso a dados e regras de negocio, organizada por dominio (kanban.ts, medicaoFinal.ts, orcamentos.ts, produtos.ts, clientes.ts, tipologias.ts, automacoes*.ts, etc). Cada arquivo tipicamente exporta funcoes async que chamam supabase diretamente.
- lib/tipos.ts — todas as interfaces/types TypeScript compartilhados (schema do app, espelha as tabelas do banco).
- lib/ai/ — modulo de IA/agente (providers, custo, auditoria, health check).
- components/ — componentes React reutilizaveis (poucos; a maior parte da UI fica dentro das proprias paginas em app/).
- supabase-migration-v*.sql — historico PARCIAL de migrations (so ate v15; ver PROBLEMAS CONHECIDOS em CURRENT_STATE.md).

## Autenticacao
- Nao usa o Supabase Auth nativo. Login proprio via tabela usuarios (lib/auth.ts) — usuario/senha simples, sessao guardada no client. app/api/criar-usuario, app/api/atualizar-usuario, app/api/resolver-login dao suporte server-side a esse fluxo.
- Nao ha middleware de protecao de rota centralizado visivel — cada pagina decide o que fazer com usuarioAtual().

## Banco de dados (Supabase project urtqbvjpwnrfaayolymt)
Tabelas principais (39 no total em public, ver CURRENT_STATE.md para lista completa): usuarios, clientes, orcamentos, kanban_colunas, medicoes_finais, medicao_colunas, medicao_itens, tipologias, tipologia_campos_extras, produtos, fornecedores, setores, setor_kanban_colunas, setor_kanban_itens, automacoes_orcamento, automacoes_setor, automacoes_assistencia, assistencias, assistencia_colunas, historico, tarefas, tarefa_colunas, crm_interacoes, crm_metas, crm_tarefas, eventos, evento_convidados, agentes_ia, agente_conversas, agente_mensagens, agente_memorias, ia_uso_log, configuracoes_gerais, permissoes, audit_log, backups, producao_colunas, producao_itens, setor_instrucoes_versoes.
- RLS habilitado nas tabelas, mas com policy "acesso total" (using true / with check true) na maioria — ou seja, RLS existe mas nao restringe nada hoje. Nao depender de RLS para seguranca.
- Sem triggers de negocio no banco (so triggers genericos de updated_at em orcamentos/clientes e triggers internos do Supabase/storage). Toda automacao de negocio roda no client (TypeScript), nao no banco.

## Fluxo de dados tipico
1. Pagina em app/ chama uma funcao de lib/*.ts (ex.: listarColunas(), moverCard()).
2. A funcao em lib/ chama supabase.from(...).select/insert/update/delete diretamente.
3. Nao ha camada de cache/estado global — cada pagina refaz o fetch quando precisa (useEffect no mount, ou apos uma acao).
4. Automacoes (ex.: mover card dispara criacao de tarefa, item em setor) sao chamadas explicitamente depois do update principal, com .catch(() => {}) para nao quebrar a acao principal se a automacao falhar.

## Padroes usados no codigo
- Funcoes de lib/ retornam T | null (ou array vazio) em erro, e fazem console.error — quase nunca lancam excecao. Codigo de UI trata null/[] como "deu erro ou nao achou".
- Tipos dinamicos que antes eram union fixo (ex.: TipoEsquadria) foram convertidos para string simples quando precisaram virar configuraveis pelo usuario (ver DECISIONS.md), mantendo os valores historicos como comentario.
- Cache leve em modulo (ex.: let tiposCache: Tipologia[] = [] em algumas paginas) para permitir que funcoes helper de modulo (fora do componente React) leiam dados carregados de forma assincrona sem precisar virar hooks.
- Workflow de deploy: toda mudanca vai para uma branch nova, PR, aguardar build da Vercel, merge manual. Nunca commit direto em main (regra do projeto).
