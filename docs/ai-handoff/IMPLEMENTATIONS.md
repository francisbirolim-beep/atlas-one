# IMPLEMENTATIONS.md — Atlas One

## 2026-08-19 — PR #207 — recuperação e gestão de senhas — CONCLUÍDA

Merge em `main`: `045f1fc8f4a75a02a19faa70e51c57d25672798d`.

Implementado sem migration:
- `lib/auth.ts`: resolução comum de usuário/e-mail, `resetPasswordForEmail` e atualização da própria senha;
- `app/login/page.tsx`: botão `Esqueci minha senha`, modo de recuperação e envio do link para o e-mail cadastrado;
- `app/redefinir-senha/page.tsx`: rota pública que valida a sessão de recovery, exige nova senha + confirmação e atualiza a senha;
- `components/AuthGate.tsx`: `/redefinir-senha` liberada como rota pública;
- `app/configuracoes/usuarios/page.tsx`: tela Master com busca de usuários e redefinição direta da senha;
- `components/Sidebar.tsx`: atalho `Usuários e Senhas` na Administração;
- `app/api/atualizar-usuario/route.ts`: mantém `auth.admin.updateUserById` server-only e passa a preservar campos ausentes no POST, evitando apagar WhatsApp ou outros dados durante uma alteração apenas de senha.

Segurança:
- endpoint administrativo continua exigindo Bearer token válido e `role=master`;
- service role não é enviado ao browser;
- senha nova exige mínimo de 6 caracteres e confirmação nas interfaces;
- recuperação por e-mail usa o fluxo nativo do Supabase Auth.

Validação:
- Build Validation verde;
- Vercel Preview `READY`;
- smoke test do Preview confirmou `/login` HTTP 200 com botão `Esqueci minha senha`;
- não foi disparado e-mail real durante o CI/smoke test;
- resta validar em produção o e-mail, redirect para `/redefinir-senha` e uma troca administrativa com usuário de teste.

Documento técnico: `docs/tecnico/recuperacao-senha-usuarios-2026-08-19.md`.

## 2026-08-19 — PR #206 — visual PC3 auditado + grid de 4 cards — CONCLUÍDA

Merge em `main`: `abebb222cd4c056f75a0adae341062774c83b501`; Vercel produção `READY`.

Implementado sem migration e sem alteração de banco:
- quatro ativos estáticos em `public/configuracoes/pc3/`, recortados do print W.Vetro confirmado;
- resolução estrita por nome exato dos presets `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- `config.imagem_url` permanece com prioridade sobre o fallback estático;
- `produto.foto_url` permanece como fallback posterior;
- nenhum nome semelhante ou outro preset recebe imagem automaticamente;
- grid das configurações no orçamento alterado de 3 para 4 colunas em desktop (`lg:grid-cols-4`).

Documento de evidência: `docs/ai-handoff/PC3_VISUAL_20260819.md`.

## 2026-08-19 — PR #196 — edição de configuração validada existente

Merge em `main`: `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`.

Implementado sem migration:
- atualização autenticada de preset existente via `PUT /api/engenharia/configuracoes-orcamento`;
- helper client `atualizarConfiguracaoValidadaOrcamento`;
- botão `Editar` na tela `Engenharia > Configurações validadas`;
- pré-carregamento de nome, evidência, valores, produto e imagem;
- troca/remoção de imagem no mesmo registro;
- linha/tipologia bloqueadas durante edição para preservar identidade técnica;
- duplicate check exclui o próprio ID;
- metadados de validação são renovados no UPDATE e `criado_por_*` é preservado.

Gates: Build Validation e Vercel Preview verdes.

## 2026-08-19 — PR #197 / #200 — correção auditada PC3 Suprema

Fonte exata: print W.Vetro do Francis mostrando `L. SUPREMA → PORTA DE CORRER 03 FOLHAS` e projetos `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

Migration: `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

A correção:
- trabalha somente com as chaves exatas `l_suprema_janela_de_correr_03_folhas` e `l_suprema_porta_de_correr_03_folhas`;
- identifica os quatro presets pela sequência exata do código normalizado contida no nome, sem fuzzy;
- exige exatamente 4 registros e 4 códigos distintos;
- aborta se houver ambiguidade ou o mesmo código em outra tipologia;
- move os 4 presets para `l_suprema_porta_de_correr_03_folhas`;
- renomeia para `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- limpa `valores` para `{}` porque a composição anterior foi inferida incorretamente;
- acrescenta evidência auditada da correção;
- remove somente os vínculos `composicao_folha_N` das janelas Suprema 02/03/04/06;
- mantém as variáveis/opções globais para futura remodelagem;
- não cria preset, receita, produto, preço, fórmula ou imagem.

### Apply — CONCLUÍDO

Após uma primeira tentativa bloqueada com segurança por um gate incorreto, a PR #200 corrigiu o gate para detectar o código exato contido no nome. Com autorização explícita do Francis, a operação temporária #201 auditou a fila, confirmou apenas `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`, aplicou a migration e confirmou o histórico remoto. A PR operacional foi fechada sem merge.

### Estado final de produção

- 4 presets PC3 em `l_suprema_porta_de_correr_03_folhas`;
- 0 alvos PC3/JC3 em `l_suprema_janela_de_correr_03_folhas`;
- `valores = {}` nos 4 presets;
- 0 vínculos `composicao_folha_N` nas janelas Suprema 02/03/04/06;
- variáveis/opções globais preservadas.

### Lição técnica

Não usar `composicao_folha_N = vidro|persiana|tela` como verdade universal. O desenho PC3-02-EF mostra composição vertical mista dentro do painel; a modelagem precisa ser revista antes de replicar valores estruturados para outras tipologias.
