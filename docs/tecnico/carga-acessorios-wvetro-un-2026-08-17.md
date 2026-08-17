# Carga reconciliada de acessórios W.Vetro — unidade UN — 2026-08-17

## Estado do pré-requisito

A migration `20260816210000_produtos_identidade_tecnica_v1.sql` foi **aplicada em produção** pelo workflow `Supabase Database Control`, run **#79**, ID `32037239260`, em 2026-08-17.

O run confirmou:
- dry-run com somente a migration de identidade técnica pendente;
- confirmação exata `APPLY_PRODUCTION`;
- etapa `Apply pending migrations` concluída com sucesso;
- log `Applying migration 20260816210000_produtos_identidade_tecnica_v1.sql...` seguido de `Finished supabase db push.`.

## Escopo desta carga

A reconciliação completa encontrou **785 acessórios faltantes** no Atlas. Distribuição por unidade da fonte:

| Unidade origem | Faltantes |
|---|---:|
| UN | 649 |
| MT | 68 |
| PR | 37 |
| BR | 16 |
| PC | 5 |
| CJ | 4 |
| TB | 2 |
| M2 | 2 |
| CT | 1 |
| RO | 1 |
| **Total** | **785** |

Esta etapa inclui **somente os 649 registros com unidade de origem `UN`**. Os outros **136** permanecem pendentes porque não existe evidência suficiente para definir automaticamente a unidade operacional de consumo do Atlas.

## Regras preservadas

- `produtos.unidade = 'UN'` somente neste subconjunto, porque a fonte também informa `UN`;
- `unidade_origem = 'UN'` e `qtde_embalagem_origem` preservam a fonte;
- `codigo_origem` preserva o código cru e `codigo` usa normalização segura;
- `origem = 'wvetro'` porque estes registros vêm diretamente da planilha reconciliada;
- `id_externo_wvetro` permanece `NULL`: não existe chave externa distinta do código técnico na fonte entregue;
- `preco = 0` é **placeholder explícito**, pois a fonte não contém preço/custo;
- linha e cor da origem ficam apenas em `dados_origem`; não viram `linha_id`, `cor_id` ou vínculos em `produto_linhas` automaticamente;
- fabricante é preservado em `marca` e no snapshot cru;
- `ncm_origem` guarda o valor cru;
- `ncm` só recebe um valor quando há 8 dígitos e não é placeholder conhecido;
- nenhum NCM é marcado automaticamente como válido: fica `pendente`, ou `invalido` quando claramente placeholder/malformado;
- `status_validacao = 'importado'` para todos os novos itens.

Entre os 649 registros:
- NCM `pendente`: **519**;
- NCM `invalido`: **130**;
- status de origem `ATENCAO`: **501**;
- status de origem `REVISAR`: **130**;
- status de origem `OK`: **18**;
- `Qtde Emb.` diferente de zero: **10**.

Nenhum desses indicadores significa validação técnica automática.

## Guardas da migration

A migration `20260817141000_carga_acessorios_wvetro_un_v1.sql` aborta a transação se:
- a staging não tiver exatamente 649 linhas;
- houver código normalizado duplicado;
- aparecer unidade diferente de `UN`;
- houver item de origem inativo;
- algum código da carga já existir em `produtos` no momento do apply;
- o pós-insert não encontrar exatamente os 649 registros esperados.

## Próximo passo

1. abrir PR desta migration;
2. executar o `Supabase Database Control` em dry-run via PR;
3. confirmar que somente esta migration está pendente e que todas as guardas passam contra a produção atual;
4. somente depois de autorização explícita, aplicar a carga em produção;
5. reauditar a base;
6. tratar separadamente os 136 acessórios com unidade de origem não-UN, sem inventar fator de conversão ou unidade operacional.
