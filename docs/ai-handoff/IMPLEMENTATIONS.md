# IMPLEMENTATIONS.md — Atlas One

> O histórico completo anterior a esta atualização foi preservado em `docs/ai-handoff/archive/2026-08-18-pre-pr183-IMPLEMENTATIONS.md`.

## 2026-08-18 — PR #183 — composição por folha + desenho técnico por configuração

PR #183 foi mergeada em `main` no commit `f89c82855218438669911246105c6c2ebc879825`.

### Implementado

- migration aditiva/idempotente `20260818210500_configuracoes_composicao_folhas_imagem_v1.sql`;
- `imagem_url` em `engenharia_variaveis_preset`, pendente de apply;
- 6 variáveis declarativas: `composicao_folha_1` a `composicao_folha_6`;
- 3 opções por variável: `vidro`, `persiana`, `tela` (18 opções no total);
- vínculos somente com as tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas, usando joins por `tipologias.chave` exata;
- 15 vínculos esperados no total (2 + 3 + 4 + 6), todos com `obrigatorio=false`;
- migration possui gates transacionais para contagem das 6 variáveis, 18 opções, 4 tipologias alvo e pelo menos 15 vínculos;
- `uploadImagemConfiguracao(file)` reutilizando `subirComTentativas('configuracoes', file)` no bucket `fotos`;
- `ConfiguracaoOrcamento` ganhou `imagem_url?: string | null`;
- criação de configuração aceita `imagemUrl`;
- API valida URL e persiste `imagem_url` somente quando fornecida, mantendo compatibilidade antes do apply;
- tela Master `Engenharia > Configurações validadas` ganhou input de imagem, preview e upload;
- listagem administrativa exibe imagem da configuração, com foto do produto como fallback;
- seletor do orçamento usa `config.imagem_url` como imagem principal do card e `produto.foto_url` como fallback;
- busca administrativa passou a considerar também os valores das variáveis estruturadas.

### O que NÃO foi feito

- nenhuma configuração real foi criada;
- nenhum preset foi validado automaticamente;
- nenhuma composição de folha foi inferida;
- nenhuma receita, perfil, acessório ou fórmula foi alterada;
- nenhuma imagem foi gerada automaticamente;
- nenhuma migration foi aplicada em produção nesta implementação.

### Gates

Head final da feature: `a628b0055ba8d3795e70e9daae141f5e59b3bfcf`.

- Build Validation #256: **success**;
- Vercel Preview: **success**;
- Supabase Database Control #102: **success em dry-run**;
- confirmação de produção: **skipped**;
- apply: **skipped**.

O deploy da `main` do merge `f89c82855218438669911246105c6c2ebc879825` foi confirmado como **success** no Vercel.

### Incidente operacional registrado

Durante a preparação da branch, um arquivo `tmp.txt` foi criado acidentalmente diretamente na `main` e removido imediatamente no commit seguinte, sem alteração líquida de conteúdo. O episódio reforça a regra permanente: **branch → PR → Build Validation verde → merge; nunca escrever diretamente em `main`**.

## Estado anterior preservado

Toda a cronologia anterior de implementações, incluindo reconciliação W.Vetro, cargas de acessórios/perfis, orçamento, cadastro, Home, colaboração, notificações, paginação e demais PRs, permanece íntegra no snapshot:

`docs/ai-handoff/archive/2026-08-18-pre-pr183-IMPLEMENTATIONS.md`
