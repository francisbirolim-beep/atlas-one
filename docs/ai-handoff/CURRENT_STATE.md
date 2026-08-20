# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — PLANO DE CORTE IMPRIMÍVEL V1 — 2026-08-20

Branch `feat/plano-corte-impressao-v1` evolui `/engenharia/formulas-corte` a partir do orientativo real do W.Vetro fornecido pelo Francis.

Implementado nesta etapa, sem migration e sem alteração de banco:
- campos manuais de identificação do plano: cliente, obra, projeto/configuração, cor de perfil, cor de acessório e vidro;
- botão `Gerar plano de corte` continua usando exclusivamente `calcularFormulasCorte` e as definições reais do Supabase;
- relatório visual separado com cabeçalho de produção, tipologia, largura/altura, tabela de perfis/cortes e variáveis selecionadas;
- botão `Imprimir / Salvar PDF` usa impressão nativa do navegador e CSS de impressão para isolar somente o documento A4;
- nenhum dado de quantidade, peso, desenho individual de perfil ou lista de vidro é inferido. Esses campos permanecem fora do relatório até existir fonte estruturada validada.

Referência W.Vetro recebida: `Core.RelOrientativoCorteSimplificadoItem (3).pdf`, orçamento #994, projeto `*SUCB-PC3-01EF`, Porta de Correr 03 Folhas Móveis | Suprema, 3000 x 3500. O documento de referência possui cabeçalho, tabela de perfis, vidro e variáveis; essa organização é a base visual da V1.

## EM VALIDAÇÃO — INTERFACE REAL DE FÓRMULAS DE CORTE PC3 — 2026-08-20

A migration `engenharia_formulas_corte_v1` foi aplicada em produção com autorização explícita do Francis. Pós-check remoto confirmou:
- tabela `engenharia_tipologia_formulas_corte` existente;
- exatamente 1 seed PC3 para a tipologia esperada;
- 3 variáveis condicionais;
- 11 definições de peças/grupos;
- histórico Supabase registrado como `20260820160019 / engenharia_formulas_corte_v1`.

PR #210 foi mergeada com `lib/formulasCorteEngine.ts`, parser restrito sem `eval`/`Function()` e resolução declarativa de dependências.

PR #211 conectou o motor ao banco e à tela `/engenharia/formulas-corte`. PR #213 adicionou navegação própria do setor Engenharia com atalhos visíveis para Painel da Engenharia, Fórmulas de Corte e Configurações de orçamento.

Pendência de governança: `20260819150000_engenharia_campos_corte_preset_v1.sql` não aparece no histórico remoto, embora `engenharia_variaveis_preset.campos_corte` exista fisicamente no schema. Não corrigir por suposição.

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

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto em `main`;
- branch → PR → Build Validation verde → merge;
- migration só conta como ativa após apply confirmado;
- qualquer apply exige autorização explícita e específica do Francis;
- antes do apply, auditar a fila completa de migrations pendentes;
- nunca inferir tipologia, composição, receita, perfil, acessório, fórmula ou vínculo por semelhança de nome;
- a imagem/desenho de configuração é evidência visual e não deve ser reinterpretada automaticamente como receita técnica.
