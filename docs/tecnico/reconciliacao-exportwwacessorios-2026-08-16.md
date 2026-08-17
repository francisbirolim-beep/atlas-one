# Reconciliação ExportWWAcessorios x Atlas — 2026-08-16

## Objetivo

Comparar a base completa `ExportWWAcessorios.xlsx` com os acessórios atualmente cadastrados no Atlas, sem executar qualquer inserção, atualização, exclusão ou migration antes do relatório completo.

## Fontes

- Fonte W.Vetro auditada: **1174 acessórios**.
- Export somente leitura do Atlas: **392 acessórios**.
- Consulta utilizada: `scripts/export-acessorios-atlas-reconciliacao.sql`.
- Export do Atlas executado em GitHub Actions usando apenas `SELECT`.
- O detalhamento integral linha a linha foi gerado na planilha de reconciliação entregue nesta etapa, com abas `Reconciliacao`, `Divergentes`, `Faltantes` e `Atlas Atual`.
- O export bruto do banco, que contém IDs internos, **não é versionado no repositório público**. O artifact do GitHub Actions tem retenção temporária.

## Método

A correspondência foi feita por **código técnico normalizado**:

1. Unicode NFKC;
2. remoção de espaços nas extremidades;
3. caixa alta;
4. espaços internos consecutivos reduzidos a um;
5. pontuação do código preservada.

Depois da correspondência por código, foram comparados somente campos com significado seguro nos dois lados:

- descrição;
- unidade;
- NCM, **somente quando o NCM da origem tem 8 dígitos e não é `12345678`**;
- ativo.

NCM `0`, `12345678` ou fora do formato de 8 dígitos é tratado como **alerta da origem**, não como valor a ser copiado ou validado automaticamente.

## Resultado consolidado

| Indicador | Quantidade |
|---|---:|
| Acessórios na fonte W.Vetro | 1174 |
| Acessórios atuais no Atlas | 392 |
| Códigos encontrados nos dois lados | 389 |
| `EXISTENTE_IGUAL` | 296 |
| `EXISTENTE_DIVERGENTE` | 93 |
| `FALTANTE_ATLAS` | 785 |
| `DUPLICADO_ORIGEM` | 0 |
| `SEM_CODIGO` | 0 |
| Itens existentes somente no Atlas | 3 |

### Leitura do resultado

- **785** dos 1174 acessórios da base completa ainda não existem no Atlas.
- Dos **389** códigos encontrados nos dois lados, **296** estão iguais nos campos comparáveis seguros.
- Existem **93** divergências reais.
- **Todas as 93 divergências reais são de unidade de medida.**
- Não foi encontrada divergência de descrição entre os códigos correspondentes.
- Não foi encontrada divergência de NCM válido/seguro entre os códigos correspondentes.
- Não foi encontrada divergência de status ativo.

## Divergências de unidade

| Unidade na origem | Quantidade divergente | Unidade atual no Atlas |
|---|---:|---|
| MT | 66 | UN |
| PR | 12 | UN |
| TB | 9 | UN |
| BR | 3 | UN |
| PT | 2 | UN |
| PC | 1 | UN |

Total: **93**.

Essas divergências devem ser tratadas explicitamente. Não sobrescrever a unidade atual em lote sem validar a regra de consumo/compra de cada categoria.

## Qualidade da fonte W.Vetro

| Alerta | Quantidade |
|---|---:|
| Linha = `GERAL` | 955 |
| Cor Única numérica | 891 |
| NCM = `0` | 156 |
| NCM = `12345678` | 65 |
| Outro NCM fora do formato de 8 dígitos | 20 |
| Unidade rara (até 5 ocorrências na fonte) | 10 |

Unidades raras por frequência: `CJ`=4, `CT`=1, `M2`=2, `PT`=2, `RO`=1.

Esses alertas **não transformam automaticamente o registro em divergente**. Eles permanecem como flags de revisão da origem.

## Campos que não puderam ser comparados

### Preço/custo

`ExportWWAcessorios.xlsx` não possui preço/custo. Portanto, preço/custo não é auditável a partir dessa fonte.

Os 392 acessórios atuais extraídos do Atlas estão com `preco = 0`, coerente com o placeholder da importação histórica, mas isso não permite inferir o custo real.

### Linha técnica e cor técnica

Na exportação atual do Atlas:

- `linha_id` preenchido: **0 de 392**;
- `cor_id` preenchido: **0 de 392**.

Logo, `Linha` e `Cor Única` da origem não podem ser comparadas semanticamente com vínculos técnicos atuais do Atlas nesta etapa.

`GERAL` e códigos numéricos de cor permanecem apenas como dados de origem até validação.

### Fabricante / marca

Na exportação atual do Atlas:

- `marca` preenchida: **0 de 392**.

A origem possui `Nome Fabricante`, mas esse campo não pode ser reconciliado com segurança contra um campo Atlas vazio.

## Itens existentes somente no Atlas

Os seguintes códigos existem entre os 392 acessórios atuais do Atlas e não aparecem na base `ExportWWAcessorios.xlsx`:

- `TELA-1000-GALV` — TELA MOSQUITEIRO GALVANIZADA 1000MM
- `TELA-132` — TELA MOSQUITEIRO FIBRA DE VIDRO 1320MM CINZA
- `TELA-254` — TELA MOSQUITEIRO FIBRA DE VIDRO 2540MM CINZA

Esses itens **não devem ser apagados** por causa da reconciliação. Devem permanecer até validação da sua origem/uso.

## Regras para a próxima etapa

1. Não inserir ou atualizar acessórios antes da aprovação deste relatório.
2. Não transformar `GERAL` em linha técnica validada.
3. Não transformar código numérico de cor em nome de cor.
4. Não validar automaticamente NCM `0`, `12345678` ou NCM com formato suspeito.
5. Preservar dados de origem (`codigo_origem`, `dados_origem`, `origem = wvetro`) quando a migration de identidade técnica for aplicada.
6. Não usar o código técnico como falso `id_externo_wvetro`.
7. Tratar os 93 divergentes de unidade sem sobrescrita silenciosa.
8. Somente depois decidir o apply da migration `20260816210000_produtos_identidade_tecnica_v1.sql`.
9. Após a migration, preparar PR separada para inclusão dos acessórios faltantes que forem considerados seguros.

## Segurança da extração

A extração usada para este relatório executou somente o script SQL já existente, que contém apenas `SELECT`. Nenhuma operação de escrita no banco foi necessária para concluir a reconciliação.
