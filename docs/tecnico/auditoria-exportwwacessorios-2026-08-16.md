# Auditoria da fonte completa de acessórios W.Vetro — 2026-08-16

Fonte analisada: `ExportWWAcessorios.xlsx` fornecido pelo usuário nesta conversa.

Objetivo desta etapa: auditar a fonte **antes de qualquer insert/update** e preparar a reconciliação contra os 392 acessórios já existentes no Atlas.

## Resultado da fonte

- total de linhas de acessórios: **1.174**;
- códigos preenchidos: **1.174**;
- códigos únicos: **1.174**;
- códigos duplicados na origem: **0**;
- descrições repetidas: **36 descrições**, envolvendo **96 linhas**; isso não é duplicidade de código e deve ser tratado apenas como alerta semântico;
- `Linha = GERAL`: **955** registros;
- `Cor Única` numérica: **891** registros;
- `Cor Única = 15`: **891** registros;
- NCM `0`: **156** registros;
- NCM placeholder `12345678`: **65** registros;
- outros NCM fora do formato de 8 dígitos: **20** registros;
- descrição ausente: **0**;
- unidade ausente: **0**;
- linha ausente: **0**;
- todos os 1.174 registros estão marcados como ativos (`Sim`).

## Unidades observadas

Principais unidades da fonte:

- UN: 945
- MT: 134
- PR: 49
- BR: 19
- TB: 11
- PC: 6
- CJ: 4
- PT: 2
- M2: 2
- CT: 1
- RO: 1

Unidades raras não foram classificadas como erradas automaticamente. Elas exigem validação de negócio.

## Linhas mais frequentes

- GERAL: 955
- HYDRO | UNIVERSAL VARANDA: 62
- VIDRO TEMPERADO VT: 45
- GUARDA-CORPO / SACADA / CORRIMÃO: 22
- ALUPRIME | VENKO: 20
- TEC-VIDRO / VERSATIK: 8
- VITRALSUL | PORTA OMEGA: 6
- PERFIL ALUMINIO | CHROMA*: 6
- FACHADA ATLANTA: 5
- PERFIL ALUMINIO | FACHADA ECOGRID: 5

## Regras obrigatórias para a reconciliação

1. **Nunca sobrescrever silenciosamente** um acessório já existente no Atlas.
2. Reconciliar por **código técnico normalizado**.
3. `GERAL` deve ser preservado como dado de origem, não como vínculo técnico validado.
4. Código numérico de `Cor Única` deve ser preservado como código de origem; não criar uma cor com nome `15`.
5. NCM `0`, `12345678` ou formato inválido não pode receber status de NCM válido automaticamente.
6. Preservar a fonte em `dados_origem`, `codigo_origem` e `origem = wvetro` quando o novo schema estiver aplicado.
7. Preço/custo **não pode ser auditado por esta planilha**, pois `ExportWWAcessorios.xlsx` não contém colunas de preço/custo.
8. Não inferir `id_externo_wvetro`: a planilha não expõe uma chave externa inequívoca além do código técnico.

## Estado da reconciliação contra o banco

O Atlas possui **392 acessórios** oriundos da extração histórica da API W.Vetro.

Nesta execução ainda não existe uma lista/export item a item desses 392 registros acessível ao agente. Portanto, **não é tecnicamente possível afirmar ainda** quantos dos 1.174 são:

- EXISTENTE IGUAL;
- EXISTENTE COM DIVERGÊNCIA;
- FALTANTE NO ATLAS.

Para completar essa etapa sem inventar dados, foi criado `scripts/export-acessorios-atlas-reconciliacao.sql`, que exporta a base atual de acessórios usando apenas colunas já existentes no schema de produção atual. O CSV/resultset dessa consulta deve ser comparado ao `ExportWWAcessorios.xlsx` antes de qualquer proposta de insert/update.

## Entrega local complementar

Foi gerada também uma planilha de auditoria com:

- resumo;
- todas as 1.174 linhas da fonte;
- status/fatores de atenção por linha;
- planilha separada apenas com pendências da fonte.

Arquivo gerado na conversa: `Auditoria_ExportWWAcessorios_Atlas.xlsx`.
