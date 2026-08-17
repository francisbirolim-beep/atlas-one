# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositório GitHub é a única fonte da verdade. Antes de alterar código, verificar o estado real do repositório. Ao concluir implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em 2026-08-16/17.

## ESTADO REAL DA MAIN

A PR #146 foi mergeada em `main` em 2026-08-17.

Commit de merge:
`f629f3598ef06b6e15e909752c2b461a3396ff07`

Ela consolidou o handoff pós-PR #143 e iniciou formalmente a reconciliação da base completa de acessórios.

## PR #147 — RECONCILIAÇÃO DE ACESSÓRIOS — EM ABERTO

Branch:
`chore/export-acessorios-reconciliacao`

A PR #147 adiciona:
- workflow reutilizável de exportação dos acessórios atuais do Atlas;
- execução manual (`workflow_dispatch`) apenas;
- sessão PostgreSQL forçada a `default_transaction_read_only=on`;
- artifact temporário com o CSV exportado;
- relatório consolidado da reconciliação em `docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`.

O primeiro export foi executado com sucesso e retornou exatamente **392 acessórios**.

Nenhum `INSERT`, `UPDATE`, `DELETE` ou migration foi executado para concluir a reconciliação.

## IDENTIDADE TÉCNICA DE PRODUTOS — MERGEADA, NÃO APLICADA

A PR #143 adicionou ao código/schema:
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

Migration final:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

**Ainda não aplicada em produção.**

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
- os 392 acessórios atuais estão com `preco = 0` como placeholder histórico.

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

Não apagar esses itens automaticamente.

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

NCM `0`, `12345678` ou formato suspeito permanece flag de origem e não participa como valor seguro de divergência.

Relatório:
`docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`

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
- preservar `codigo_origem`, `dados_origem` e `origem = wvetro` quando o schema estiver ativo;
- só preencher `id_externo_wvetro` com chave externa real;
- não inventar linha, cor, NCM, fabricante, preço ou custo.

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
- não inventar medidas, fórmulas, NCM, linha, cor ou identificador externo;
- credenciais W.Vetro nunca devem ficar no frontend/browser em integração permanente.
