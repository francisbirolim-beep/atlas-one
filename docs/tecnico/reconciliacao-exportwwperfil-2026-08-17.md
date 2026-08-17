# Reconciliação `ExportWWPerfil (1)(1).xlsx` x Atlas — 2026-08-17

## Objetivo

Auditar a fonte real de perfis W.Vetro, exportar o snapshot atual da categoria `perfil` do Atlas em modo somente leitura e reconciliar os registros por código técnico antes de qualquer escrita no banco.

## Segurança do snapshot Atlas

O snapshot foi executado pelo GitHub Actions em sessão PostgreSQL com transação explicitamente `READ ONLY`.

Run de auditoria:
- workflow temporário: `Temp Export Profiles Reconciliation`;
- run #2 / ID `32045643983`;
- `transaction_read_only = on` confirmado antes do SELECT;
- export concluído com **1.307 linhas**;
- artifact com SHA-256 gerado pelo próprio workflow.

Nenhuma escrita foi executada no banco nessa auditoria.

## Fonte W.Vetro

Arquivo recebido:
`ExportWWPerfil (1)(1).xlsx`

Estrutura auditada:
- **1.307** linhas de perfis;
- **1.307** códigos preenchidos;
- **1.307** códigos únicos;
- **0** códigos duplicados;
- todos os registros com `Ativo = Sim`.

### Unidades da fonte

- `BR`: **1.256**;
- `MT`: **26**;
- `UN`: **25**.

A unidade da fonte não deve substituir automaticamente a unidade operacional do Atlas.

### Tamanho informado na fonte

Distribuição:
- `6000`: **1.262**;
- `6500`: **11**;
- `3000`: **8**;
- `5800`: **8**;
- `5950`: **7**;
- `6`: **6**;
- `5000`: **2**;
- `60000`: **1**;
- `2500`: **1**;
- `4600`: **1**.

Há **7** registros com tamanho atípico para um campo em milímetros (`6` ou `60000`). Esses valores serão preservados como dado de origem e **não** serão promovidos automaticamente para `produtos.tamanho_barra_mm`.

Registros de tamanho atípico:
- `42-004` — `LINHA 42` — tamanho de origem `60000`;
- `TQ-10X10X1,00MM` — tamanho de origem `6`;
- `TR-1/2"X1,5MM` — tamanho de origem `6`;
- `TRT-40X15X1,20MM` — tamanho de origem `6`;
- `TRT-50X20X1.50MM` — tamanho de origem `6`;
- `TRT-50X70` — tamanho de origem `6`;
- `TRT-60X40X1.5` — tamanho de origem `6`.

Não inferir se `6` significa 6 metros nem se `60000` é erro de digitação.

### Peso informado na fonte

Todos os 1.307 registros possuem peso e o valor atual do Atlas coincide com o valor importado da fonte para os 1.307 códigos.

Dois valores estão acima da regra de revisão técnica (> 50) e devem permanecer sinalizados, sem correção automática:
- `0000000056` — `SU 012 LATERAL LISA` — peso de origem `3462`;
- `0000000171` — `SU 050 TRAVESSA CENTRAL` — peso de origem `11538`.

Não inferir unidade alternativa nem dividir/multiplicar esses valores automaticamente.

### NCM da fonte

Classificação conservadora, conforme `DECISIONS.md`:
- NCM não claramente inválido, ainda pendente de validação humana: **1.068**;
- placeholder inequívoco (`0`, `12345678`, `12345667` ou vazio): **221**;
- formato atípico diferente de 8 dígitos: **18**.

Valores relevantes:
- `0`: **213**;
- `12345678`: **7**;
- `12345667`: **1**;
- `761010000` (9 dígitos): **14**;
- `16`: **4**.

Os quatro NCMs `16` não foram promovidos ao NCM operacional no Atlas e devem continuar apenas como dado cru de origem.

### Outros sinais de revisão da fonte

- `Nome Fabricante = 16`: **68** registros;
- `Cod.Barras` preenchido: **61** registros;
- `Sucata` diferente de zero: **83** registros;
- descrições repetidas: **138** grupos envolvendo **411** linhas, sem duplicidade de código.

Esses campos são preservados como dados crus de origem. Não interpretar automaticamente `Obs = 16`, fabricante numérico, conteúdo de `Cod.Barras` ou `Sucata` como regra técnica/comercial.

## Snapshot atual do Atlas

Categoria `perfil`:
- **1.307** registros;
- `codigo` preenchido nos **1.307**;
- `origem = legado` nos **1.307** antes desta reconciliação;
- `unidade_origem` vazia nos **1.307**;
- `tamanho_barra_mm` vazio nos **1.307**;
- `tamanho_barra_mm_origem` vazio nos **1.307**;
- `status_validacao = importado` nos **1.307**;
- `ncm_status = pendente`: **1.082**;
- `ncm_status = invalido`: **225**.

## Reconciliação por código técnico

Resultado:
- fonte W.Vetro: **1.307** códigos;
- Atlas: **1.307** códigos;
- presentes nos dois lados: **1.307**;
- faltantes no Atlas: **0**;
- somente no Atlas: **0**;
- duplicados na fonte: **0**;
- duplicados no Atlas: **0**.

### Comparação dos campos já importados historicamente

Os seguintes campos coincidem em todos os 1.307 códigos:
- descrição (desconsiderando o prefixo `CODIGO - ` usado no `nome` do Atlas);
- unidade operacional;
- peso atualmente armazenado;
- ativo.

NCM:
- **1.303** coincidem exatamente;
- **4** possuem `NCM = 16` na fonte e NCM operacional vazio no Atlas, comportamento conservador que deve ser preservado.

Fabricante/marca:
- **1.239** coincidem exatamente;
- **68** possuem `Nome Fabricante = 16` na fonte e marca operacional vazia no Atlas, comportamento conservador que deve ser preservado.

Classificação final:
- `EXISTENTE_IGUAL`: **1.235**;
- `EXISTENTE_FONTE_NAO_PROMOVIDA`: **72**;
- `EXISTENTE_DIVERGENTE`: **0**.

Portanto, **não há carga de novos perfis a executar** e não há motivo para sobrescrever campos operacionais.

## Decisão para a próxima migration

A próxima migration deve ser exclusivamente de proveniência dos 1.307 perfis já existentes.

Pode preencher somente campos de origem/reconciliação, por exemplo:
- `origem = wvetro` após correspondência confirmada;
- `codigo_origem` com o código cru da fonte;
- `unidade_origem` com a unidade cru da fonte;
- `tamanho_barra_mm_origem` com o valor cru de `Tamanho`;
- `ncm_origem` com o NCM cru, inclusive valores inválidos/atípicos;
- `dados_origem` com a linha real do `ExportWWPerfil (1)(1).xlsx` e flags de revisão.

Não deve alterar automaticamente:
- `nome`;
- `categoria`;
- `preco`/`custo`;
- `unidade` operacional;
- `peso_kg_m`;
- `tamanho_barra_mm` operacional;
- `ncm` operacional;
- `marca` operacional;
- `ativo`;
- `linha_id`;
- `cor_id`;
- `id_externo_wvetro`.

A migration deve abortar se o snapshot de códigos/IDs não continuar compatível e deve fazer pós-check de que nenhum campo operacional foi alterado.

## Artefato de conferência

Foi gerada uma planilha de reconciliação com:
- resumo;
- reconciliação completa dos 1.307 códigos;
- linhas com flags de revisão da fonte;
- fonte W.Vetro;
- snapshot Atlas.

Arquivo de trabalho da conversa:
`Reconciliacao_ExportWWPerfil_Atlas.xlsx`.
