# NEXT_TASK.md — Atlas One

## TAREFA ATUAL

Concluir a reconciliação da base completa `ExportWWAcessorios.xlsx` (1.174 acessórios) contra os 392 acessórios atualmente existentes no Atlas, **sem inserir ou atualizar nada antes do relatório completo**.

## ESTADO DE PARTIDA

PR #143 foi mergeada em `main`.

Commit de merge:
`bc08fe6443e41475497d8c1947f840236dc00762`

Migration de identidade técnica mergeada, mas ainda pendente de apply em produção:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

Não aplicar automaticamente.

## AUDITORIA DA FONTE JÁ CONCLUÍDA

Arquivo:
`ExportWWAcessorios.xlsx`

Resultado:
- 1.174 acessórios;
- 1.174 códigos preenchidos;
- 1.174 códigos únicos;
- 0 códigos duplicados;
- 36 descrições repetidas / 96 linhas envolvidas;
- 955 com Linha `GERAL`;
- 891 com Cor Única numérica;
- 891 especificamente com código de cor `15`;
- 156 NCM `0`;
- 65 NCM `12345678`;
- 20 outros NCM com formato diferente de 8 dígitos;
- 0 descrição ausente;
- 0 unidade ausente;
- todos ativos.

Relatório:
`docs/tecnico/auditoria-exportwwacessorios-2026-08-16.md`

## PRÓXIMO PASSO OBRIGATÓRIO

Obter a lista item a item dos 392 acessórios atuais do Atlas.

Foi criado o script somente leitura:
`scripts/export-acessorios-atlas-reconciliacao.sql`

A consulta deve retornar pelo menos:
- id;
- código inferido pelo prefixo de `nome` antes de ` - `;
- nome;
- preço;
- unidade;
- NCM;
- grupo;
- marca;
- fornecedor_id;
- linha_id;
- cor_id;
- ativo;
- timestamps.

A consulta foi desenhada para funcionar **antes** da aplicação da migration pendente de identidade técnica.

## RECONCILIAÇÃO

Depois de obter o export dos 392, comparar por código técnico normalizado e classificar cada linha da planilha completa em:

1. `EXISTENTE_IGUAL`
2. `EXISTENTE_DIVERGENTE`
3. `FALTANTE_ATLAS`
4. `DUPLICADO_ORIGEM`
5. `SEM_CODIGO`
6. `REVISAR`

## CAMPOS DE COMPARAÇÃO

Quando disponíveis nos dois lados:
- código;
- descrição/nome;
- unidade;
- NCM;
- linha;
- cor/código de cor;
- marca/fabricante;
- ativo;
- preço/custo somente quando a fonte realmente trouxer esses campos.

IMPORTANTE: `ExportWWAcessorios.xlsx` não contém colunas de preço/custo. Logo, preço/custo não pode ser validado contra essa fonte.

## REGRAS

- nunca sobrescrever silenciosamente;
- `GERAL` é dado de origem, não vínculo técnico validado;
- código numérico de cor não vira nome de cor;
- NCM `0`, `12345678` ou formato suspeito não vira válido automaticamente;
- preservar `codigo_origem`;
- preservar `dados_origem`;
- usar `origem = wvetro` para itens provenientes dessa base;
- só preencher `id_externo_wvetro` quando houver uma chave externa real; não usar o código técnico como falso ID externo;
- não inventar linha, cor, NCM, fabricante, preço ou custo;
- nenhum insert/update antes da aprovação do relatório de reconciliação.

## RELATÓRIO OBRIGATÓRIO ANTES DE IMPORTAR

Entregar:
- total planilha;
- total banco;
- existentes iguais;
- existentes divergentes;
- faltantes;
- duplicados;
- sem código;
- NCM suspeitos;
- Linha GERAL;
- cor numérica/origem;
- unidades raras/suspeitas;
- campos impossíveis de comparar por ausência na fonte;
- lista detalhada dos divergentes;
- lista detalhada dos faltantes.

## DEPOIS DA RECONCILIAÇÃO

Somente após validação do relatório:
1. decidir se aplica primeiro `20260816210000_produtos_identidade_tecnica_v1.sql` em produção;
2. preparar PR separada para inserir apenas acessórios faltantes seguros;
3. tratar divergentes sem sobrescrita silenciosa;
4. reexecutar `scripts/auditoria-produtos-wvetro.sql` após qualquer importação;
5. depois tratar o backfill dos 1.307 perfis a partir de `ExportWWPerfil (1).xlsx`.

## PERFIS — PRÓXIMA FASE

`ExportWWPerfil (1).xlsx` possui 1.307 perfis e será tratado depois dos acessórios.

Já foram observados dados que exigem validação antes do backfill, incluindo pesos muito fora da faixa comum e tamanhos de barra com possíveis diferenças de unidade. Não corrigir automaticamente.

## CUIDADOS PERMANENTES

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge;
- não aplicar migration automaticamente em produção;
- Plano de Corte parte do produto cadastrado;
- receita específica por produto tem prioridade;
- snapshot não altera receita mestre;
- fórmula não validada não gera medida;
- credenciais W.Vetro nunca ficam no frontend/browser em integração permanente.
