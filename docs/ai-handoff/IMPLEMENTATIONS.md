# IMPLEMENTATIONS.md â Atlas One

## 2026-08-19 â PR #194 â Catalogo por Linha com modelos clicaveis

PR #194 foi mergeada em `main` no commit `da7c6df`.

### Implementado

- `app/cadastro/produtos/por-linha/page.tsx`: os modelos (tipologias) de cada linha, antes exibidos como pilulas estaticas (`span`), agora sao links clicaveis (`Link`) para `/engenharia/configuracoes-orcamento?linha={id}&tipologia={id}`, abrindo a tela de configuracoes validadas ja filtrada pela linha e tipologia clicadas. Vale para todas as linhas/tipologias cadastradas, nao um caso isolado;
- `app/engenharia/configuracoes-orcamento/page.tsx` (commit `40b8ab9`, mesma PR): passou a ler os parametros de URL `linha` e `tipologia` em `carregar()` para pre-selecionar a tela direto no destino certo.

### O que NAO foi feito

- nenhuma migration, alteracao de schema ou dado foi tocada;
- nenhum preset/configuracao foi criado ou alterado.

### Gates

- Build Validation: **success**;
- Vercel Preview: **Ready**;
- ambos os commits (`40b8ab9`, `7fe1070`) marcados **Verified**.

## 2026-08-18 â Cadastro real: L. Suprema > Janela De Correr 03 Folhas (4 configuraÃ§Ãµes)

4 configuraÃ§Ãµes reais foram cadastradas em produÃ§Ã£o em `Engenharia > ConfiguraÃ§Ãµes validadas`, com base no sistema W.Vetro real (print de tela do Francis, cÃ³digos `*SUCB-JC3-01EF` a `04EF`):

- 01EF â vidro/vidro/vidro;
- 02EF â persiana/persiana/persiana;
- 03EF â persiana/vidro (folha 3 deixada em branco de propÃ³sito: o desenho tÃ©cnico deste cÃ³digo sÃ³ mostra 2 painÃ©is, apesar do agrupamento "03 folhas" do W.Vetro â nÃ£o inventado, sinalizado na evidÃªncia);
- 04EF â vidro/tela (mesma ressalva de 2 painÃ©is).

Todos os 4 presets: `validado=true`, `ativo=true`, `usar_no_orcamento=true`, com `evidencia_validacao` citando o cÃ³digo W.Vetro e o print de origem. Confirmado direto no banco via Supabase MCP (leitura): 4 linhas em `engenharia_variaveis_preset` para a tipologia `l_suprema_janela_de_correr_03_folhas`, valores conferem exatamente.

`imagem_url` dos 4 presets estÃ¡ `null`: as 4 imagens foram recortadas do print original (`card_01EF.png` a `card_04EF.png`) e entregues ao Francis nesta sessÃ£o, mas o upload automÃ¡tico para o Supabase Storage nÃ£o foi possÃ­vel â a ferramenta de upload de arquivo do navegador usada nesta sessÃ£o sÃ³ aceita arquivos explicitamente compartilhados com a sessÃ£o, e a pasta de outputs local nÃ£o estava nessa lista. Upload manual pendente (rÃ¡pido, via "Selecionar imagem" na tela de configuraÃ§Ã£o).

## 2026-08-18 â Apply em produÃ§Ã£o â composiÃ§Ã£o de folha / imagem de configuraÃ§Ã£o

A migration `20260818210500_configuracoes_composicao_folhas_imagem_v1.sql` (da PR #183, ver entrada abaixo) foi aplicada em produÃ§Ã£o via `Supabase Database Control` (`mode=apply`, `confirmation=APPLY_PRODUCTION`), com autorizaÃ§Ã£o explÃ­cita do Francis. Antes do apply, a fila completa de migrations pendentes foi auditada â sÃ³ essa migration estava pendente.

PÃ³s-estado confirmado direto no banco:
- coluna `engenharia_variaveis_preset.imagem_url` ativa;
- 6 variÃ¡veis `composicao_folha_1` a `composicao_folha_6`;
- 18 opÃ§Ãµes (`vidro`/`persiana`/`tela` por posiÃ§Ã£o);
- 15 vÃ­nculos em `engenharia_tipologia_variaveis` para L. Suprema > Janela de Correr 02/03/04/06 folhas;
- 0 linhas em `engenharia_variaveis_preset` â nenhuma configuraÃ§Ã£o real foi criada pela migration.

PrÃ³ximo passo era cadastro humano (nÃ£o cÃ³digo) â ver entrada acima, jÃ¡ concluÃ­da.

## 2026-08-18 â PR #183 â composiÃ§Ã£o por folha + desenho tÃ©cnico por configuraÃ§Ã£o

PR #183 foi mergeada em `main` no commit `f89c82855218438669911246105c6c2ebc879825`.

### Implementado

- migration aditiva/idempotente `20260818210500_configuracoes_composicao_folhas_imagem_v1.sql`;
- `imagem_url` em `engenharia_variaveis_preset` (ativa apÃ³s o apply registrado acima);
- 6 variÃ¡veis declarativas: `composicao_folha_1` a `composicao_folha_6`;
- 3 opÃ§Ãµes por variÃ¡vel: `vidro`, `persiana`, `tela` (18 opÃ§Ãµes no total);
- vÃ­nculos somente com as tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas, usando joins por `tipologias.chave` exata;
- 15 vÃ­nculos esperados no total (2 + 3 + 4 + 6), todos com `obrigatorio=false`;
- migration possui gates transacionais para contagem das 6 variÃ¡veis, 18 opÃ§Ãµes, 4 tipologias alvo e pelo menos 15 vÃ­nculos;
- `uploadImagemConfiguracao(file)` reutilizando `subirComTentativas('configuracoes', file)` no bucket `fotos`;
- `ConfiguracaoOrcamento` ganhou `imagem_url?: string | null`;
- criaÃ§Ã£o de configuraÃ§Ã£o aceita `imagemUrl`;
- API valida URL e persiste `imagem_url` somente quando fornecida, mantendo compatibilidade antes do apply;
- tela Master `Engenharia > ConfiguraÃ§Ãµes validadas` ganhou input de imagem, preview e upload;
- listagem administrativa exibe imagem da configuraÃ§Ã£o, com foto do produto como fallback;
- seletor do orÃ§amento usa `config.imagem_url` como imagem principal do card e `produto.foto_url` como fallback;
- busca administrativa passou a considerar tambÃ©m os valores das variÃ¡veis estruturadas.

### O que NÃO foi feito

- nenhuma configuraÃ§Ã£o real foi criada;
- nenhum preset foi validado automaticamente;
- nenhuma composiÃ§Ã£o de folha foi inferida;
- nenhuma receita, perfil, acessÃ³rio ou fÃ³rmula foi alterada;
- nenhuma imagem foi gerada automaticamente.

### Gates

Head final da feature: `a628b0055ba8d3795e70e9daae141f5e59b3bfcf`.

- Build Validation #256: **success**;
- Vercel Preview: **success**;
- Supabase Database Control #102: **success em dry-run**.

O deploy da `main` do merge `f89c82855218438669911246105c6c2ebc879825` foi confirmado como **success** no Vercel.

### Incidente operacional registrado

Durante a preparaÃ§Ã£o da branch, um arquivo `tmp.txt` foi criado acidentalmente diretamente na `main` e removido imediatamente no commit seguinte, sem alteraÃ§Ã£o lÃ­quida de conteÃºdo. Na sequÃªncia, a atualizaÃ§Ã£o de handoff (PR #184) gerou uma cadeia de branches/PRs temporÃ¡rias (#185â#190) tentando reexecutar o preview da Vercel, o que esgotou o limite diÃ¡rio gratuito de deploys da Vercel (100/dia). As branches temporÃ¡rias foram fechadas sem merge pela prÃ³pria sessÃ£o, com nota explÃ­cita de "nÃ£o mergear"; `.github/workflows` em `main` foi conferido e estÃ¡ limpo. O episÃ³dio reforÃ§a a regra permanente: **branch â PR â Build Validation verde â merge; nunca escrever diretamente em `main`; evitar reexecuÃ§Ãµes desnecessÃ¡rias de deploy**.

## Estado anterior preservado

Toda a cronologia anterior de implementaÃ§Ãµes, incluindo reconciliaÃ§Ã£o W.Vetro, cargas de acessÃ³rios/perfis, orÃ§amento, cadastro, Home, colaboraÃ§Ã£o, notificaÃ§Ãµes, paginaÃ§Ã£o e demais PRs, permanece Ã­ntegra no snapshot:

`docs/ai-handoff/archive/2026-08-18-pre-pr183-IMPLEMENTATIONS.md`
