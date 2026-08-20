# IMPLEMENTATIONS.md — Atlas One

## 2026-08-20 — interface de validação das fórmulas de corte PC3 — EM VALIDAÇÃO

Pré-requisitos já concluídos:
- PR #210 mergeada com `lib/formulasCorteEngine.ts`;
- migration `engenharia_formulas_corte_v1` aplicada em produção com autorização explícita do Francis;
- pós-check remoto: tabela criada, 1 seed PC3, 3 variáveis e 11 peças/grupos;
- histórico Supabase: `20260820160019 / engenharia_formulas_corte_v1`.

Implementado na branch `feat/formulas-corte-interface`:
- `lib/engenhariaFormulasCorte.ts`: leitura das definições ativas de `engenharia_tipologia_formulas_corte` via Supabase;
- `app/engenharia/formulas-corte/page.tsx`: tela de teste com tipologia, largura, altura, variáveis condicionais e cálculo pelo motor da PR #210;
- tabela de resultado por código/eixo em mm;
- `components/Sidebar.tsx`: atalho Master `Fórmulas de Corte`;
- nenhuma gravação de plano de corte, nenhuma liberação de produção e nenhuma nova migration.

Objetivo desta etapa: comparar o resultado do Atlas com o W.Vetro antes de ligar o motor ao plano de corte operacional.

## 2026-08-20 — motor declarativo de fórmulas de corte PC3 — PR #210

Continuidade do trabalho iniciado pelo Claude após a PR #209.

Implementado:
- motor declarativo para ler `variaveis` + `pecas` de `engenharia_tipologia_formulas_corte`;
- parser aritmético restrito, sem `eval` e sem `Function()`;
- aceita somente números, identificadores resolvidos, `+ - * /`, parênteses e `ROUND(expr)`;
- tokenização cobre a string inteira e rejeita caracteres não permitidos;
- valida largura/altura positivas e opções declaradas da tipologia;
- resolve condições por variável e mapeamento de código de perfil;
- resolve dependências entre peças até não haver mais progresso;
- acusa explicitamente dependência circular, código de referência ausente, divisão por zero e definição inválida.

Referência W.Vetro #994, 3000 x 2500 sem contramarco / mão-de-amigo comum:
- SU010 = 2970;
- SU012 = 2496;
- SU008 = 2483;
- SU280 = 2466;
- SU102(H) = 2315;
- travessas = 938.

## 2026-08-19 — PR #207 — recuperação e gestão de senhas — CONCLUÍDA

Merge em `main`: `045f1fc8f4a75a02a19faa70e51c57d25672798d`.

Implementado sem migration:
- `lib/auth.ts`: resolução comum de usuário/e-mail, `resetPasswordForEmail` e atualização da própria senha;
- `app/login/page.tsx`: botão `Esqueci minha senha`, modo de recuperação e envio do link para o e-mail cadastrado;
- `app/redefinir-senha/page.tsx`: rota pública que valida a sessão de recovery, exige nova senha + confirmação e atualiza a senha;
- `components/AuthGate.tsx`: `/redefinir-senha` liberada como rota pública;
- `app/configuracoes/usuarios/page.tsx`: tela Master com busca de usuários e redefinição direta da senha;
- `components/Sidebar.tsx`: atalho `Usuários e Senhas` na Administração;
- `app/api/atualizar-usuario/route.ts`: mantém `auth.admin.updateUserById` server-only e passa a preservar campos ausentes no POST.

Validação: Build Validation verde e Vercel Preview `READY`.

## 2026-08-19 — PR #206 — visual PC3 auditado + grid de 4 cards — CONCLUÍDA

Merge em `main`: `abebb222cd4c056f75a0adae341062774c83b501`; Vercel produção `READY`.

Implementado sem migration e sem alteração de banco:
- quatro ativos estáticos em `public/configuracoes/pc3/`;
- resolução estrita por nome exato dos presets `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- `config.imagem_url` permanece com prioridade;
- grid das configurações no orçamento em 4 colunas no desktop.

## 2026-08-19 — PR #196 — edição de configuração validada existente

Merge em `main`: `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`.

Implementado sem migration:
- atualização autenticada de preset existente via `PUT /api/engenharia/configuracoes-orcamento`;
- helper client `atualizarConfiguracaoValidadaOrcamento`;
- botão `Editar` na tela `Engenharia > Configurações validadas`;
- pré-carregamento de nome, evidência, valores, produto e imagem;
- troca/remoção de imagem no mesmo registro;
- linha/tipologia bloqueadas durante edição;
- duplicate check exclui o próprio ID.

## 2026-08-19 — PR #197 / #200 — correção auditada PC3 Suprema

Fonte exata: print W.Vetro do Francis mostrando `L. SUPREMA → PORTA DE CORRER 03 FOLHAS` e projetos `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

Migration `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql` aplicada com autorização explícita após gate corrigido na PR #200. Estado final: 4 presets PC3 na tipologia correta, valores inferidos removidos e vínculos de composição incorretos retirados das janelas Suprema.

## 2026-08-19 — Campos de Corte por Perfil — PR #209

Migration `20260819150000_engenharia_campos_corte_preset_v1.sql` adicionou `campos_corte jsonb` em `engenharia_variaveis_preset`. A coluna existe fisicamente em produção, embora essa versão não apareça no histórico remoto atual do Supabase; tratar essa divergência em tarefa separada.

Permite registrar por configuração um mapa `codigo_perfil -> texto livre` com fórmulas/observações documentais. Exemplo real cadastrado na config `*SUCB-PC3-02-EF` com dados do orçamento W.Vetro #994.
