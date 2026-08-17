# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositório GitHub é a única fonte da verdade. Antes de alterar código, verificar o estado real do repositório. Ao concluir implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em 2026-08-16/17.

## ESTADO REAL DA MAIN

A PR #146 foi mergeada em `main` em 2026-08-17.

Commit de merge:
`f629f3598ef06b6e15e909752c2b461a3396ff07`

Ela consolidou o handoff pós-PR #143 e iniciou formalmente a reconciliação da base completa de acessórios.

## PR #147 — RECONCILIAÇÃO / UNIDADE / PROVENIÊNCIA — EM ABERTO

Branch:
`chore/export-acessorios-reconciliacao`

A PR #147 contém:
- workflow reutilizável de exportação dos acessórios atuais do Atlas;
- execução manual (`workflow_dispatch`) apenas;
- sessão PostgreSQL forçada a `default_transaction_read_only=on`;
- artifact temporário com o CSV exportado;
- relatório consolidado da reconciliação em `docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`;
- correção da migration de identidade técnica após descoberta de divergência de unidade/proveniência;
- suporte em `lib/produtos.ts` para `unidade_origem` e `qtde_embalagem_origem`.

O primeiro export foi executado com sucesso e retornou exatamente **392 acessórios**.

Nenhum `INSERT`, `UPDATE`, `DELETE` ou migration foi executado em produção para concluir a reconciliação.

## CHECKS DA CORREÇÃO TÉCNICA

Commit técnico validado:
`235d31f0b3ec900f9eb06157ab1a75cd6133de26`

Resultados:
- `Supabase Database Control`: **success**;
- `Audit migration history`: **success**;
- `Dry-run pending migrations`: **success**;
- `Apply pending migrations`: **skipped**;
- `Build Validation`: **success**;
- `Vercel`: **success**.

A migration corrigida passou no dry-run e **não foi aplicada em produção**.

Commits posteriores de handoff/documentação não alteram a migration nem a lógica de produto; o gate operacional continua sendo merge manual e, depois, decisão explícita de apply.

## IDENTIDADE TÉCNICA DE PRODUTOS — MIGRATION PENDENTE E CORRIGIDA NA PR #147

A PR #143 havia adicionado ao código/schema proposto:
- `codigo`;
- `codigo_origem`;
- `origem`;
- `id_externo_wvetro`;
- `peso_kg_m`;
- `tamanho_barra_mm`;
- `tamanho_barra_mm_origem`;
- `dados_origem jsonb`;
- `status_validacao` e auditoria;
- `ncm_origem` / `ncm_status`;
- tabela `produto_linhas` N:N;
- busca por código/nome/descrição;
- badge de código técnico.

Migration:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

**Ainda não aplicada em produção.**

A reconciliação posterior mostrou que uma premissa da migration original era falsa: `produtos.unidade` dos acessórios atuais não pode ser tratado como valor cru W.Vetro, pois todos os 392 registros atuais estão em `UN`, enquanto 93 códigos correspondentes na fonte usam MT/PR/TB/BR/PT/PC.

Além disso, a fonte possui `Qtde Emb.`, o que impede assumir automaticamente que a unidade da fonte é a unidade operacional/consumo.

A migration foi corrigida na PR #147 para adicionar:
- `unidade_origem`;
- `qtde_embalagem_origem`.

E para alterar o backfill seguro:
- `produtos.unidade` permanece unidade operacional do Atlas;
- `unidade_origem` e `qtde_embalagem_origem` não recebem o `UN` legado como falso valor de origem;
- produtos técnicos preexistentes recebem `origem = legado` até reconciliação;
- `dados_origem` dos registros legados é identificado como `atlas_legacy_pre_reconciliacao`;
- o nome no formato `CODIGO - DESCRICAO` não basta para afirmar `origem = wvetro`;
- `id_externo_wvetro` continua sem preenchimento artificial.

Não considerar os novos campos/tabela ativos no banco até haver execução confirmada do workflow `Supabase Database Control` com:
- mode: `apply`;
- confirmation: `APPLY_PRODUCTION`.

## BASE W.VETRO EXISTENTE NO ATLAS

Extração histórica registrada:
- 1.038 vendas/orçamentos W.Vetro analisados;
- 109 tipologias novas;
- 871 produtos importados;
- 479 perfis;
- 392 acessórios;
- os 392 acessórios atuais estão com `preco = 0` como placeholder histórico;
- os 392 acessórios atuais estão com `unidade = UN`, o que não representa fielmente a unidade da fonte em pelo menos 93 casos.

## BASE COMPLETA DE ACESSÓRIOS — AUDITORIA

`ExportWWAcessorios.xlsx`:
- 1.174 acessórios;
- 1.174 códigos preenchidos;
- 1.174 códigos únicos;
- 0 códigos duplicados;
- 36 descrições repetidas / 96 linhas envolvidas;
- 955 com `Linha = GERAL`;
- 891 com Cor Única numérica;
- 156 NCM `0`;
- 65 NCM `12345678`;
- 20 outros NCM fora do formato de 8 dígitos;
- todos ativos.

Relatório de auditoria:
`docs/tecnico/auditoria-exportwwacessorios-2026-08-16.md`

## RECONCILIAÇÃO COMPLETA — RESULTADO

Comparação por código técnico normalizado entre 1.174 itens da fonte e 392 acessórios atuais do Atlas:

- códigos encontrados nos dois lados: **389**;
- `EXISTENTE_IGUAL`: **296**;
- `EXISTENTE_DIVERGENTE`: **93**;
- `FALTANTE_ATLAS`: **785**;
- `DUPLICADO_ORIGEM`: **0**;
- `SEM_CODIGO`: **0**;
- itens existentes somente no Atlas: **3**.

Os 3 itens somente no Atlas são:
- `TELA-1000-GALV`;
- `TELA-132`;
- `TELA-254`.

Não apagar esses itens automaticamente. A existência deles também impede classificar todo produto técnico legado como W.Vetro apenas pelo padrão do nome.

## DIVERGÊNCIAS REAIS

As **93 divergências** encontradas são exclusivamente de **unidade de medida**:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Entre códigos correspondentes:
- divergência de descrição: 0;
- divergência de NCM válido/seguro: 0;
- divergência de ativo: 0.

A fonte também possui `Qtde Emb.`. Exemplos entre os divergentes:
- PT com 121 e 89;
- PC com 8;
- MT com ocorrências 50 e 1.

Não interpretar automaticamente `Qtde Emb.` como fator de conversão.

## IMPACTO EM ENGENHARIA

O código atual usa `produtos.unidade` como campo operacional. Ao selecionar um produto em uma receita de Engenharia, a tela copia `produto.unidade` para `engenharia_receita_componentes.unidade`.

Consequência:
- não sobrescrever os 93 divergentes em lote;
- unidade da fonte deve ficar separada em `unidade_origem`;
- eventual unidade de compra/estoque/conversão só será modelada após validação operacional.

## CAMPOS NÃO COMPARÁVEIS NESTA ETAPA

- preço/custo: fonte W.Vetro não possui esses campos;
- `linha_id`: 0/392 preenchidos no Atlas atual;
- `cor_id`: 0/392 preenchidos no Atlas atual;
- `marca`: 0/392 preenchidos no Atlas atual.

Portanto linha, cor e fabricante da origem devem ser preservados como dados de origem, sem validação técnica automática.

## REGRAS DE RECONCILIAÇÃO PRESERVADAS

- reconciliar por código técnico normalizado;
- nunca sobrescrever silenciosamente;
- `GERAL` permanece dado de origem, não linha técnica validada;
- código numérico de cor permanece código de origem, não nome de cor;
- NCM `0`, `12345678` ou formato suspeito não recebe status válido automaticamente;
- registros legados permanecem com proveniência não confirmada até correspondência real;
- quando a fonte estiver confirmada, preservar `codigo_origem`, `unidade_origem`, `qtde_embalagem_origem`, `dados_origem` e então registrar `origem = wvetro`;
- só preencher `id_externo_wvetro` com chave externa real;
- não inventar linha, cor, NCM, fabricante, preço, custo, unidade operacional ou fator de conversão.

## PRÓXIMO GATE

A PR #147 deve permanecer aberta até revisão/merge manual.

Depois do merge:
1. decidir explicitamente se aplica `20260816210000_produtos_identidade_tecnica_v1.sql` em produção;
2. apply somente via `Supabase Database Control` com `APPLY_PRODUCTION`;
3. confirmar o apply antes de considerar os novos campos ativos;
4. só então preparar PR separada de carga dos 785 faltantes seguros.

## PLANO DE CORTE / ENGENHARIA

Mantêm-se as decisões já validadas:
- produto cadastrado é a entrada do Plano de Corte;
- receita específica por produto tem prioridade;
- receita genérica da tipologia é fallback;
- snapshot do plano não altera receita mestre;
- fórmula não validada não inventa corte;
- variantes devem ser declarativas, sem `eval`.

## MEDIÇÃO FINAL OFICIAL

Rota operacional:
`/producao/medicao-final`

Ordem por peça:
1. identificação;
2. fotos de trena largura/altura;
3. largura baixo/meio/cima;
4. altura direita/meio/esquerda;
5. contramarco/arremate/cadeirinha/cantoneira SIM/NÃO;
6. observação;
7. campos configuráveis;
8. fotos adicionais.

## CUIDADOS PERMANENTES

- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge manual;
- migration só é considerada ativa após confirmação do apply em produção;
- não usar `migration repair --reverted` sem diagnóstico explícito;
- não inventar medidas, fórmulas, NCM, linha, cor, unidade ou identificador externo;
- credenciais W.Vetro nunca devem ficar no frontend/browser em integração permanente.
