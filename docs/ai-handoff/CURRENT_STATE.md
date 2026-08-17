# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositório GitHub é a única fonte da verdade. Antes de alterar código, verificar o estado real do repositório. Ao concluir implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em 2026-08-16.

## ESTADO REAL DA MAIN

A PR #143 foi **mergeada em `main`** em 2026-08-17 01:55:49 UTC.

Commit de merge:
`bc08fe6443e41475497d8c1947f840236dc00762`

O status Vercel desse commit está `success`.

A PR #143 passou antes do merge em:
- Build Validation;
- Supabase Database Control / dry-run;
- verificação de merge sem conflitos.

## IDENTIDADE TÉCNICA DE PRODUTOS — MERGEADA

A PR #143 adicionou ao código/schema do Atlas:
- `codigo`;
- `codigo_origem`;
- `origem`;
- `id_externo_wvetro`;
- `peso_kg_m`;
- `tamanho_barra_mm`;
- `tamanho_barra_mm_origem`;
- `dados_origem jsonb`;
- `status_validacao` (`importado`, `revisado`, `validado`);
- campos de auditoria de validação;
- `ncm_origem`;
- `ncm_status` (`pendente`, `valido`, `invalido`);
- tabela `produto_linhas` para relação N:N produto x linha;
- busca por código/nome/descrição no Cadastro de Produtos;
- badge de código técnico nos produtos.

Migration final correta:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

## MIGRATION AINDA NÃO APLICADA EM PRODUÇÃO

A migration `20260816210000_produtos_identidade_tecnica_v1.sql` está mergeada no repositório, mas **não foi aplicada em produção**.

Não considerar os novos campos/tabela ativos no banco até haver execução confirmada do workflow `Supabase Database Control` com:
- mode: `apply`
- confirmation: `APPLY_PRODUCTION`

Decisão operacional atual: **não aplicar ainda** até fechar a auditoria/reconciliação da base completa de acessórios e confirmar que o modelo atende a fonte completa sem perda de informação.

## CORREÇÃO DE HISTÓRICO DE MIGRATION

A divergência de versão de `setor_cadastro_v1` foi resolvida na PR #144 por rename puro do arquivo local para a versão já registrada em produção:
`20260816204749_setor_cadastro_v1.sql`.

O conteúdo SQL não foi alterado e o Supabase Database Control voltou a ficar verde.

A correção foi incorporada à branch da PR #143 antes do merge.

## BASE W.VETRO EXISTENTE NO ATLAS

Extração histórica já registrada:
- 1.038 vendas/orçamentos W.Vetro analisados;
- 109 tipologias novas criadas;
- 871 produtos importados da composição histórica das vendas;
- desses produtos: 479 perfis + 392 acessórios;
- os 392 acessórios estão com `preco = 0` como placeholder da extração histórica.

## ARQUIVOS COMPLETOS DISPONÍVEIS NA CONVERSA

O usuário forneceu:
- `ExportWWAcessorios.xlsx` — 1.174 acessórios;
- `ExportWWPerfil (1).xlsx` — 1.307 perfis.

Essas bases são mais completas que a extração histórica de itens vendidos e devem ser reconciliadas sem sobrescrita silenciosa.

## AUDITORIA DA FONTE DE ACESSÓRIOS — CONCLUÍDA

Auditoria de `ExportWWAcessorios.xlsx`:
- 1.174 linhas;
- 1.174 códigos preenchidos;
- 1.174 códigos únicos;
- 0 códigos duplicados na origem;
- 36 descrições repetidas, envolvendo 96 linhas;
- 955 registros com `Linha = GERAL`;
- 891 registros com `Cor Única` numérica;
- 891 registros com `Cor Única = 15`;
- 156 registros com NCM `0`;
- 65 registros com NCM `12345678`;
- 20 outros registros com NCM fora do formato de 8 dígitos;
- 0 descrição ausente;
- 0 unidade ausente;
- 0 linha ausente;
- todos os 1.174 marcados como ativos.

Fonte detalhada:
`docs/tecnico/auditoria-exportwwacessorios-2026-08-16.md`

## BLOQUEIO ATUAL DA RECONCILIAÇÃO

Ainda não existe neste ambiente uma exportação item a item dos 392 acessórios atuais do banco Atlas.

Sem essa lista não é seguro afirmar quantos itens da planilha são:
- EXISTENTE IGUAL;
- EXISTENTE COM DIVERGÊNCIA;
- FALTANTE NO ATLAS.

Foi criado o script somente leitura:
`scripts/export-acessorios-atlas-reconciliacao.sql`

Ele exporta os acessórios atuais usando apenas colunas já existentes antes da migration pendente. O resultado deve ser comparado à planilha completa antes de qualquer insert/update.

## REGRAS DE RECONCILIAÇÃO

- reconciliar por código técnico normalizado;
- nunca sobrescrever silenciosamente;
- `GERAL` permanece dado de origem, não linha técnica validada;
- código numérico de cor permanece código de origem, não nome de cor;
- NCM `0`, `12345678` ou formato suspeito não recebe status válido automaticamente;
- preservar `codigo_origem`, `dados_origem`, `origem = wvetro` e identificador externo somente quando houver evidência real;
- a planilha de acessórios não contém preço/custo, portanto esses campos não podem ser auditados a partir dela;
- nenhuma inserção dos acessórios faltantes deve ocorrer antes do relatório de reconciliação completo.

## PLANO DE CORTE / ENGENHARIA

Mantêm-se as decisões já validadas:
- produto cadastrado é a entrada do Plano de Corte;
- receita específica por produto tem prioridade;
- receita genérica da tipologia é fallback;
- snapshot do plano não altera receita mestre;
- fórmula não validada não inventa corte;
- variantes devem ser declarativas, sem `eval`.

## MEDIÇÃO FINAL OFICIAL

A rota operacional continua:
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
- branch -> PR -> Build Validation -> merge;
- migration só é considerada ativa após confirmação do apply em produção;
- não usar `migration repair --reverted` sem diagnóstico explícito;
- não inventar medidas, fórmulas, NCM, linha, cor ou identificador externo;
- credenciais W.Vetro nunca devem ficar no frontend/browser em integração permanente.
