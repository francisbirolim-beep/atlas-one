# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
PR #130 ja foi mesclada em main (merged em 2026-08-16 02:17 UTC). As migrations do Plano de Corte e de receitas por produto ja estao aplicadas em producao (confirmado via SQL em 2026-08-16: tabelas planos_corte, plano_corte_componentes existem e engenharia_receitas.produto_id existe). O texto abaixo (BLOQUEIO OPERACIONAL) estava desatualizado e foi mantido apenas como historico.

Agora em andamento: branch `francisbirolim-beep-patch-10` implementa a secao "3. Variantes condicionais" descrita mais abaixo -- variaveis declarativas por tipologia (com opcoes, nao texto livre), variantes condicionais nos componentes da receita e presets fixos salvaveis. Ver secao "ATUALIZACAO -- variaveis declarativas" no fim deste arquivo.

## ESTADO DA PR #130
Implementado:
1. base tecnica real da Porta de Correr 03 Folhas Suprema em `docs/tecnico/receitas/porta-correr-3f-suprema.md`;
2. migration `20260815223000_receitas_por_produto_v1.sql` para `engenharia_receitas.produto_id`;
3. receita generica por tipologia preservada como fallback e receita ativa especifica por produto permitida;
4. `engenhariaReceitas.ts` com busca/criacao de receita por produto mantendo compatibilidade pre-migration;
5. `lib/formulasCorte.ts`, parser aritmetico restrito sem `eval`;
6. migration original do Plano de Corte corrigida para `public.*` + RLS/policy permissiva temporaria;
7. Supabase Database Control ja passou no dry-run das migrations da PR.

Antes do merge, confirmar Build Validation verde no head final da PR.

## BLOQUEIO OPERACIONAL — APPLY DO BANCO
O workflow nao aplica migrations automaticamente no merge.

Para ativar o Plano de Corte persistente e as receitas por produto em producao e necessario executar manualmente `Supabase Database Control` com:
- mode: `apply`
- confirmation: `APPLY_PRODUCTION`

Migrations pendentes relevantes:
- `20260815100000_plano_corte_producao_v1.sql`;
- `20260815223000_receitas_por_produto_v1.sql`.

Nao declarar essas estruturas como ativas no banco sem confirmar o workflow `apply` concluido com sucesso.

(Historico: confirmado em 2026-08-16 que essas migrations ja estao aplicadas em producao.)

## PROXIMA IMPLEMENTACAO APOS PR #130
### 1. Produto -> receita automatica
- ao selecionar produto no Plano de Corte, buscar primeiro receita ativa do `produto_id`;
- se nao existir, oferecer fallback generico da tipologia;
- mostrar claramente qual receita/versao esta sendo usada;
- permitir troca manual somente para Master/edicao.

### 2. Validacao formal de formulas
Adicionar metadados de validacao na receita/componente, por exemplo:
- `formula_validada`;
- `formula_validada_em`;
- `formula_validada_por_id/nome`;
- observacao/evidencia tecnica.

Somente formula marcada como validada pode preencher `corte_mm` automaticamente. Formula nao validada continua apenas como referencia.

### 3. Variantes condicionais
Criar estrutura declarativa para variantes que alteram componentes/geometria, especialmente:
- mao-de-amigo comum/largo;
- reforco interno/externo;
- fechadura;
- roldana 100/200 kg;
- contramarco;
- arremate;
- trilho convencional/embutido;
- numero/montagem das folhas.

Nao colocar condicoes arbitrarias em `eval` nem em scripts salvos no banco.

## PORTA 3F SUPREMA — BASE CANDIDATA FORTE
Amostras reais W.Vetro suportam:
- `SU010 = largura - 30`;
- `TMC = largura - 30`;
- `SU012 = altura - folga_altura` (4 mm nas amostras);
- montantes verticais da folha = `altura - 34`;
- SU102 vertical = `altura - 185`;
- vidro altura = `altura - 167`;
- MP347 face interna observado: horizontal = `largura + 44`; vertical = `altura + 22`.

Ainda NAO automatizar largura da folha/vidro. Mesmo vao 2500 x 2100 gerou 771 mm e 756 mm conforme mao-de-amigo/reforco.

## DEPOIS DA RECEITA 3F
- acessorios e quantidades reais;
- usinagens;
- lista de barras/perfis;
- otimizacao de barras de 6 m;
- reaproveitamento de sobras;
- PDF/romaneio de producao com desenho tecnico validado;
- vinculo direto com obra/Medicao Final/Engenharia liberada.

## VALIDACOES PARALELAS
- Medicao Final: parcial, tempo, historico, seis medidas, fotos e SIM/NAO;
- Configuracoes -> Orcamento: salvar/recarregar e validar PDF real;
- mobile: navegacao essencial/Favoritos/Voltar/Inicio.

## W.VETRO API
Chamadas live ainda dependem de credenciais/ambiente de teste e schemas reais. Integracao server-side, inicialmente somente leitura, sem adivinhar campos.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional e `/producao/medicao-final`.
- Plano de Corte parte do produto cadastrado.
- Receita especifica do produto tem prioridade; generica da tipologia e fallback.
- Snapshot nunca modifica silenciosamente a receita mestre.
- Formula nao validada nao gera medida.
- PDF W.Vetro original deve ser preservado.
- Credenciais W.Vetro nunca ficam no browser.


## ATUALIZACAO -- W.Vetro extracao historica concluida -- 2026-08-16
Diferente do que este arquivo dizia antes ("credenciais/ambiente de teste ainda sao prerequisitos"): o usuario forneceu credenciais reais da API W.Vetro no chat e uma extracao pontual (nao recorrente) foi feita:
- 109 tipologias novas inseridas em `tipologias` (total 120), a partir de Linha+Modelo reais de 1038 vendas/orcamentos;
- 871 produtos inseridos em `produtos` (479 perfil + 392 acessorio) com `preco = 0` (placeholder);
- mapeamento completo da API em `docs/ai-handoff/WVETRO_API_MAPPING.md`;
- detalhes/limitacoes em IMPLEMENTATIONS.md, secao "W.Vetro -- extracao historica inicial".

Isto NAO substitui nem conflita com o trabalho de integracao live/server-side descrito acima (PR #130 e receitas por produto) -- sao objetivos diferentes. O aviso "Credenciais W.Vetro nunca ficam no browser" (secao CUIDADOS) permanece valido como norma para integracao PERMANENTE; a extracao pontual feita aqui usou o browser por necessidade tecnica (sandbox sem rede ate api.wvetro.com.br) e a aba/token foram descartados ao final.

Pendente agora: revisar/precificar o catalogo de produtos importado (esta com preco 0) antes de usar em orcamento real.


## ATUALIZACAO -- variaveis declarativas + variantes + presets -- 2026-08-16
Implementado na branch `francisbirolim-beep-patch-10` (secao "3. Variantes condicionais" deste documento):
- migration `20260816150000_engenharia_variantes_v1.sql`: tabelas `engenharia_variaveis`, `engenharia_variavel_opcoes`, `engenharia_tipologia_variaveis`, `engenharia_componente_variantes`, `engenharia_variaveis_preset`;
- `lib/engenhariaVariaveis.ts`: CRUD completo + `resolverVarianteComponente` (a variante mais especifica cujas condicoes batem 100% com as variaveis escolhidas vence; sem eval, sem heuristica oculta) + `aplicarVarianteAoComponente`;
- `app/engenharia/receitas/page.tsx`: nova secao "Variaveis desta tipologia" (vincular variavel do catalogo, criar variavel nova, criar/remover opcoes) e, por componente da receita, um painel de "Variantes condicionais" (combinacao de variaveis -> produto/formula alternativos);
- `app/producao/plano-corte/page.tsx`: as variaveis do plano deixam de ser campo de texto livre e viram `<select>` com as opcoes cadastradas para aquela tipologia; adiciona presets fixos salvaveis (nome + marcar como padrao, pre-carrega automaticamente na proxima vez); ao gerar o plano, cada componente base passa por `resolverVarianteComponente` antes de virar snapshot -- se nenhuma variante bater, usa o componente base (nunca inventa).

Pendente antes de declarar isso ativo em producao: aplicar a migration `20260816150000_engenharia_variantes_v1.sql` via `Supabase Database Control` (`apply` + `APPLY_PRODUCTION`), abrir PR, confirmar Build Validation verde, mergear. Depois do merge, o catalogo de variaveis vem vazio de vinculos (so a seed de variaveis/opcoes) -- o Master precisa entrar em Engenharia > Receitas tecnicas e vincular as variaveis certas a cada tipologia antes delas aparecerem no Plano de Corte.

## ATUALIZACAO -- identidade tecnica de Produto -- 2026-08-16
Branch `feat/produtos-identidade-tecnica-wvetro` (ainda nao mesclada; PR #143).
Adiciona identidade tecnica confiavel ao cadastro de Produtos (perfis/acessorios
W.Vetro): `codigo`/`codigo_origem`/`origem`/`id_externo_wvetro`,
`peso_kg_m`/`tamanho_barra_mm`/`tamanho_barra_mm_origem`, `dados_origem jsonb`
(snapshot congelado do que veio do W.Vetro), `status_validacao`
(importado/revisado/validado), `ncm_origem`/`ncm_status`
(pendente/valido/invalido, sem corrigir o NCM), tabela `produto_linhas` (N:N
produto<->linha) e unique index parcial em `upper(codigo)`. Detalhes completos
em IMPLEMENTATIONS.md e CURRENT_STATE.md; decisoes de arquitetura em
DECISIONS.md; auditoria pre-migration em
`docs/tecnico/auditoria-produtos-2026-08-16.md`.

Nota sobre o arquivo de acessorios: o arquivo completo `ExportWWAcessorios`
(~1.174 linhas) nao estava disponivel no ambiente desta execucao; o banco
atual contem apenas 392 acessorios de uma importacao anterior. A base
completa de 1.174 acessorios sera reconciliada em etapa separada (ver item 3
da lista abaixo) -- reconciliacao por codigo tecnico, nunca sobrescrita
silenciosa.

Antes de mergear a PR #143:
- confirmar Build Validation verde;
- confirmar Supabase Database Control (dry-run) verde para a migration
`20260816180000_produtos_identidade_tecnica_v1.sql`;
- NAO aplicar essa migration em producao automaticamente -- apply manual via
`workflow_dispatch` (`apply` + `APPLY_PRODUCTION`) fica para depois do merge,
com confirmacao explicita do usuario.

Depois do merge, proxima implementacao (em ordem):
1. aplicar `20260816180000_produtos_identidade_tecnica_v1.sql` em producao via
`Supabase Database Control` (`apply` + `APPLY_PRODUCTION`);
2. gerar e aplicar o backfill de `tamanho_barra_mm`/`tamanho_barra_mm_origem` a
partir da coluna "Tamanho" de `ExportWWPerfil (1).xlsx` (dados ja levantados,
migration nao commitada nesta PR por escopo);
3. reconciliar a base completa de acessorios (`ExportWWAcessorios`, ~1.174
linhas) contra os 392 ja existentes no banco -- por CODIGO tecnico: codigo ja
existe = comparar campos; codigo novo = candidato a insercao; mesmo codigo com
dados diferentes = marcar divergencia; codigo duplicado na origem = revisar;
nunca sobrescrever silenciosamente. Gerar relatorio de auditoria completo
(total planilha, total banco, existentes iguais, existentes divergentes,
faltantes no banco, duplicados, sem codigo, NCM suspeito, linha GERAL, cor
numerica/origem, unidade suspeita, preco/custo suspeito) ANTES de propor
qualquer insert. Preservar `codigo_origem`/`dados_origem`/`origem=wvetro`/id
externo/linha e cor originais mesmo quando pendentes de validacao. Nao
transformar "GERAL" em linha tecnica validada, codigo de cor numerico em nome
de cor, nem NCM placeholder em NCM valido. PR separada desta.
4. vincular `produto_linhas` a alguma tela (hoje so existe o CRUD em
`lib/produtoLinhas.ts`, nenhuma tela usa ainda);
5. avaliar se vale uma tela de detalhe tecnico dedicada para produto, ou se o
formulario atual ja e suficiente.
