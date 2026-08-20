# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — MOTOR DECLARATIVO DE FÓRMULAS DE CORTE PC3 — 2026-08-20

Continuidade do trabalho iniciado pelo Claude após a PR #209.

Estado real verificado no repositório:
- `supabase/migrations/20260820000000_engenharia_formulas_corte_v1.sql` já está na `main`;
- essa migration cria `engenharia_tipologia_formulas_corte` e contém seed para `Porta De Correr 03 Folhas (L. Suprema)` com variáveis e fórmulas baseadas nas amostras W.Vetro #994 registradas pelo usuário;
- a migration **não é considerada aplicada em produção** nesta etapa, pois não houve apply remoto confirmado por este trabalho;
- `lib/formulasCorteEngine.ts` não existia na `main` e foi criado na branch `feat/formulas-corte-engine-pc3`.

Motor implementado:
- parser aritmético restrito, sem `eval` e sem `Function()`;
- aceita somente números, identificadores conhecidos, `+ - * /`, parênteses e `ROUND(expr)`;
- tokenização cobre a fórmula inteira e rejeita caracteres não permitidos;
- valida largura/altura e opções declaradas;
- suporta condições por variável, códigos de perfil mapeados por combinação e fórmulas por variável;
- resolve dependências entre peças até não haver progresso, acusando dependência circular ou dado faltante;
- não gera plano de corte de produção automaticamente.

Referência real já documentada para W.Vetro #994, 3000 x 2500, sem contramarco / mão-de-amigo comum:
- SU010 2970;
- SU012 2496;
- SU008 2483;
- SU280 2466;
- SU102(H) 2315;
- travessas 938.

A migration já contém a correção observada pelo Claude para contramarco: SU280 e os montantes de mão-de-amigo passam de `Altura - 34` para `Altura - 46`.

Nenhuma migration foi aplicada nesta branch. A próxima etapa é validar PR/build e só então decidir, com autorização explícita do Francis, se a migration deve ser aplicada.

## ESTADO AUTORITATIVO — RECUPERAÇÃO E GESTÃO DE SENHAS — 2026-08-19

PR #207 foi mergeada em `main` no commit `045f1fc8f4a75a02a19faa70e51c57d25672798d`, sem migration.

Implementado:
- Login possui `Esqueci minha senha`;
- usuário pode informar nome de usuário ou e-mail; o Atlas resolve o e-mail cadastrado e solicita recovery pelo Supabase Auth;
- link de recovery retorna para a rota pública `/redefinir-senha`;
- nessa rota o usuário define e confirma a nova senha e depois volta ao login;
- Master possui `Configurações > Usuários e Senhas`, com busca e redefinição direta da senha de qualquer usuário;
- troca direta usa o endpoint autenticado `/api/atualizar-usuario` e `supabaseAdmin.auth.admin.updateUserById` somente no servidor;
- a API foi corrigida para não apagar WhatsApp/nome/e-mail/role quando esses campos não forem enviados;
- Sidebar do Master possui atalho `Usuários e Senhas`.

Gates da PR #207: Build Validation verde e Vercel Preview `READY`. O Preview confirmou renderização do botão `Esqueci minha senha`. O teste funcional restante é disparar um e-mail real em produção e confirmar o redirect/recovery completo, além de testar uma redefinição administrativa com usuário de teste.

Documento técnico: `docs/tecnico/recuperacao-senha-usuarios-2026-08-19.md`.

## ENGENHARIA - CAMPOS DE CORTE POR PERFIL - PR #209 MERGEADA E MIGRATION APLICADA - 2026-08-19

PR #209 ("feat: Campos de Corte em Configuracoes de Orcamento (Porta de Correr 3 Folhas)") foi mergeada em `main`.

Migration `20260819150000_engenharia_campos_corte_preset_v1.sql` foi aplicada em producao (autorizacao explicita do usuario), adicionando a coluna `campos_corte jsonb not null default '{}'::jsonb` em `engenharia_variaveis_preset`. Aditiva, sem afetar linhas existentes.

Implementado:
- `lib/orcamentoConfiguracoes.ts` e `app/api/engenharia/configuracoes-orcamento/route.ts` normalizam e persistem `campos_corte` (mapa `codigo_perfil -> texto livre`);
- nova secao "Campos de corte (formula por perfil, texto livre)" em `app/engenharia/configuracoes-orcamento/page.tsx`, permitindo adicionar/editar/remover linhas por perfil;
- e documentacao/observacao a partir de testes reais no W.Vetro, nao formula validada nem calculo automatico.

Exemplo real cadastrado na config `*SUCB-PC3-02-EF` (Porta De Correr 03 Folhas, L. Suprema), com dados do orcamento #994:
- SU010 = 2970mm; SU012 = 2496mm; SU008 = 2483mm; SU053 = 938mm; SU225 = 938mm; SU280 = 2466mm; SU040 = 2466mm; SU041 = 2466mm; SU102(L) = 938mm; SU102(H) = 2315mm; TMC = 2970mm.

Segundo o usuario: os dados de corte partem da tipologia e do tamanho da marca (o sistema monta a tipologia e calcula aproveitamento/sobra); os codigos de perfil (SU010, SU012 etc.) vem do cadastro de produtos/perfis, nao sao exclusivos de uma config especifica.

## CONCLUÍDO — VISUAL PC3 NO SELETOR — PR #206 — 2026-08-19

PR #206 foi mergeada e publicada em produção no commit `abebb222cd4c056f75a0adae341062774c83b501`.

Os quatro desenhos recortados do print W.Vetro confirmado para `SUPREMA → PORTA DE CORRER 03 FOLHAS` estão associados no seletor por correspondência **exata** do nome do preset:
- `*SUCB-PC3-01EF` → `/configuracoes/pc3/SUCB-PC3-01EF.png`;
- `*SUCB-PC3-02-EF` → `/configuracoes/pc3/SUCB-PC3-02-EF.png`;
- `*SUCB-PC3-03-EF` → `/configuracoes/pc3/SUCB-PC3-03-EF.png`;
- `*SUCB-PC3-04-EF` → `/configuracoes/pc3/SUCB-PC3-04-EF.png`.

`imagem_url` continua sendo a fonte prioritária quando existir. O desenho estático é fallback auditado somente para esses quatro códigos, sem fuzzy e sem alterar banco. O grid do orçamento usa 4 colunas em desktop (`lg:grid-cols-4`).

## ESTADO AUTORITATIVO — PC3 SUPREMA CORRIGIDO EM PRODUÇÃO — 2026-08-19

### Evidência W.Vetro confirmada

O print real compartilhado pelo Francis mostra explicitamente:
- Linha: `L. SUPREMA`;
- Modelo: `PORTA DE CORRER 03 FOLHAS`;
- projetos: `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

O cadastro anterior como `Janela de Correr 03 Folhas / JC3` estava incorreto. Também tinham sido gravados valores `composicao_folha_N` inferidos visualmente e não sustentados pela evidência real.

### PR #196 — edição de preset existente — CONCLUÍDA

PR #196 foi mergeada em `main` no commit `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`, com Build Validation e Vercel verdes, sem migration.

Implementado:
- editar uma configuração validada já existente sem criar duplicata;
- `PUT /api/engenharia/configuracoes-orcamento`, Master-only;
- pré-carregar nome, evidência, valores, produto e imagem;
- trocar/remover imagem no mesmo preset;
- linha e tipologia ficam bloqueadas na edição para preservar identidade técnica;
- checagem de duplicidade ignora o próprio ID;
- criação/ativação continuam separadas.

### PR #197 + PR #200 — correção PC3/JC3 — APLICADA EM PRODUÇÃO

PR #197 introduziu a migration `supabase/migrations/20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

O primeiro apply autorizado foi bloqueado com segurança antes de qualquer alteração: o gate original comparava o nome inteiro normalizado do preset com o código puro e encontrou 0 alvos. Auditoria read-only do banco confirmou que existiam exatamente 4 presets, com nomes descritivos contendo os códigos `*SUCB-JC3-01EF` a `04EF`.

PR #200 corrigiu apenas esse gate para detectar a sequência exata do código dentro do nome normalizado, sem fuzzy/semelhança. Gates da PR #200: Build Validation verde, Vercel Preview verde e Supabase Database Control dry-run verde.

Com autorização explícita do Francis, o segundo apply foi executado pela operação temporária da PR #201. Antes do write, a fila completa foi auditada novamente e continha exatamente uma migration pendente: `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`. O apply terminou com sucesso e o histórico remoto confirmou `20260819062000 | 20260819062000`. A PR #201 foi fechada sem merge, portanto seu workflow temporário não entrou na `main`.

### Estado final confirmado pela própria migration

A transação só conclui se todos os pós-checks passarem. O estado autoritativo em produção é:
- exatamente 4 presets sob `l_suprema_porta_de_correr_03_folhas`;
- nomes exatos `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- zero desses alvos permanece em `l_suprema_janela_de_correr_03_folhas`;
- `valores = {}` nos 4 presets;
- zero vínculos `composicao_folha_1..6` nas tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas;
- as variáveis/opções globais `composicao_folha_N` permanecem no catálogo para futura remodelagem correta.

### Arquitetura de composição — decisão atual

Não replicar a modelagem `composicao_folha_N = vidro|persiana|tela` para novas tipologias com base apenas no print. Os projetos W.Vetro podem possuir subdivisões/composições dentro de um mesmo painel/folha. A próxima modelagem precisa representar a configuração visual real sem inventar semântica técnica.

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto em `main`;
- branch → PR → Build Validation verde → merge;
- migration só conta como ativa após apply confirmado;
- qualquer apply exige autorização explícita e específica do Francis;
- antes do apply, auditar a fila completa de migrations pendentes;
- nunca inferir tipologia, composição, receita, perfil, acessório, fórmula ou vínculo por semelhança de nome;
- a imagem/desenho de configuração é evidência visual e não deve ser reinterpretada automaticamente como receita técnica.
