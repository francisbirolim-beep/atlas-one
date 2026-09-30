# Atlas One — Staging W.Vetro no Neon

Data: 30/09/2026  
Branch: `feat/wvetro-migracao-operacional-v1`

## Decisão arquitetural

O Neon será usado como **banco isolado de staging da migração operacional W.Vetro**.

O Supabase continua sendo o backend operacional atual do Atlas para:

- autenticação;
- usuários;
- Cliente 360;
- obras;
- orçamentos;
- financeiro;
- compras;
- estoque;
- produção.

O Neon não substitui o Supabase nesta fase.

Fluxo:

```
W.Vetro API
   ↓
Neon / schema wvetro_migracao
   ↓
reconciliação
   ↓
prévia Master
   ↓
aprovação
   ↓
Supabase / tabelas oficiais Atlas
```

## Por que separar

1. Nenhum payload bruto W.Vetro entra nas tabelas oficiais.
2. Reprocessar um lote não duplica registros.
3. Alterações do W.Vetro geram nova versão auditável.
4. A migração pode ser descartada/recriada sem afetar o Atlas.
5. A conexão do staging fica server-side na Vercel.

## Driver

Dependência:

```
@neondatabase/serverless
```

O Atlas usa o driver serverless do Neon para as rotas Next.js executadas na Vercel.

## Variáveis de ambiente

Obrigatória para staging:

```
NEON_STAGING_DATABASE_URL=postgresql://...
```

A connection string deve existir somente no ambiente de servidor/Vercel.

Nunca criar:

```
NEXT_PUBLIC_NEON_STAGING_DATABASE_URL
```

porque isso exporia a credencial ao navegador.

Gate de escrita:

```
WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED=false
```

O padrão deve permanecer desligado.

Somente depois de:

1. conexão Neon testada;
2. schema aplicado;
3. dry-run conferido;
4. primeira carga aprovada;

alterar temporariamente no ambiente de staging/preview para:

```
WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED=true
```

## Schema

Arquivo:

```
neon/migrations/20260930_wvetro_migracao_operacional_staging.sql
```

Schema Postgres:

```
wvetro_migracao
```

Tabelas:

- `wvetro_migracao.execucoes`
- `wvetro_migracao.raw`
- `wvetro_migracao.vinculos`
- `wvetro_migracao.pendencias`

### execucoes

Armazena checkpoint e estatísticas da carga:

- recurso;
- período;
- status;
- total lido;
- novos;
- vinculados;
- divergentes;
- ignorados;
- erros;
- usuário que iniciou;
- início/fim.

### raw

Snapshot imutável de origem:

- recurso;
- chave externa;
- data de referência;
- versão;
- payload JSONB;
- SHA-256 do payload.

Restrição:

```
unique (recurso, chave_externa, payload_hash)
```

Isto garante idempotência para cópias idênticas.

### vinculos

Relacionamento:

```
W.Vetro -> Atlas
```

Sem alterar a origem.

Exemplo:

```
recurso = pessoas
chave_externa = pessoa:123
entidade_atlas = cliente
atlas_id = <uuid>
status = vinculado
metodo_match = cpf_cnpj_exato
```

### pendencias

Fila para:

- falta de chave segura;
- conflito de CPF/CNPJ;
- múltiplos candidatos;
- erro de promoção;
- divergência financeira;
- produto sem correspondência.

## Segurança

O schema Neon não é acessado pelo browser.

Somente rotas server-side do Atlas usam a connection string.

O SQL revoga permissões do papel genérico `public` no schema e tabelas.

Para uma fase futura, se necessário, criar um usuário Postgres exclusivo de migração com acesso somente ao schema `wvetro_migracao`.

## APIs do Atlas

### Mapa / preview

```
GET /api/integracoes/wvetro/migracao-operacional/preview
```

O retorno `recurso=mapa` inclui:

- status W.Vetro;
- status de configuração Neon;
- mapa dos endpoints.

Teste de conexão Neon:

```
?recurso=mapa&testarNeon=1
```

O teste verifica:

- conexão;
- database;
- usuário;
- existência do schema `wvetro_migracao`.

### Captura

```
POST /api/integracoes/wvetro/migracao-operacional/capturar
```

Padrão:

```json
{
  "dryRun": true
}
```

Não grava nada.

Para staging real:

```json
{
  "dryRun": false
}
```

A rota exige simultaneamente:

1. usuário Atlas Master;
2. W.Vetro configurado;
3. `NEON_STAGING_DATABASE_URL`;
4. `WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED=true`;
5. schema `wvetro_migracao` existente.

Mesmo quando todos os gates passam:

- não escreve no W.Vetro;
- não escreve em `clientes`;
- não escreve em tabelas oficiais Atlas;
- grava somente no Neon staging.

## Reconciliação de Pessoas

O Cliente 360 continua sendo lido do Supabase para comparação.

Regra atual:

### vínculo seguro automático

Somente:

```
CPF/CNPJ W.Vetro == CPF/CNPJ Atlas
e existe exatamente um cliente Atlas
```

### sugestão/revisão

Telefone, celular e e-mail são sinais de correspondência.

Não promovem automaticamente.

### proibido

Nome isolado nunca gera merge automático.

## Promoção futura Neon -> Supabase

Ainda não implementada nesta fase.

Quando for implementada, deverá:

1. ler somente registros revisados/aprovados;
2. promover por entidade;
3. usar transação lógica/idempotência;
4. gravar vínculo após promoção;
5. registrar erro como pendência;
6. nunca apagar snapshot Neon;
7. permitir auditoria completa.

## Sequência para ativação

1. Conectar plugin Neon ao ChatGPT ou criar projeto pelo Neon Console.
2. Criar projeto/banco de staging.
3. Obter connection string server-side.
4. Configurar `NEON_STAGING_DATABASE_URL` na Vercel Preview.
5. Aplicar `neon/migrations/20260930_wvetro_migracao_operacional_staging.sql`.
6. Abrir painel Master:
   `/configuracoes/integracoes/wvetro/migracao-operacional`
7. Rodar teste Neon.
8. Rodar análise de Pessoas.
9. Conferir totais e divergências.
10. Manter write flag desligada durante a conferência.
11. Habilitar escrita apenas para a primeira captura de staging.
12. Conferir idempotência executando o mesmo lote novamente.
13. Somente depois iniciar Orçamentos/Pedidos.

## Não fazer

- não migrar Atlas inteiro para Neon nesta etapa;
- não mover Supabase Auth;
- não expor connection string no frontend;
- não promover automaticamente novos clientes;
- não calcular saldo oficial de estoque a partir de histórico parcial;
- não transformar composição histórica W.Vetro em receita técnica oficial sem validação.


## Estado validado em 30/09/2026

O staging operacional já contém e foi auditado sem promoção automática para tabelas oficiais do Atlas.

### Cargas principais

- Orçamentos: **736** snapshots únicos.
- Clientes W.Vetro classificados por `Tipopessoa=CL`: **596**.
- Pedidos: **127**.
- Lotes de produção: **79**.
- Projetos de produção: **144**.
- Instalações: **17**.
- Títulos: **938**.
- Títulos baixados: **509**.

### Reconciliação de clientes CL

Fila persistida no Neon:

- vínculo seguro por CPF/CNPJ exato e único: **6**;
- sugestões fortes: **4**;
- revisão: **2**;
- novos sem correspondência suficiente: **584**;
- divergentes: **0**.

Nenhum desses registros foi criado ou alterado automaticamente no Cliente 360.

### Auditoria de relações

View:

```
wvetro_migracao.auditoria_relacoes
```

Totais validados:

- relações auditadas: **1.486**;
- relações encontradas diretamente: **1.065**;
- ausências brutas: **421**;
- duplicatas exatas: **0**.

As 421 ausências brutas não equivalem a 421 erros.

Classificação operacional:

- **297** baixas sem título correspondente na carga de `titulos`: reconstruíveis pelo próprio payload de `titulos_baixados`;
- **43** pedidos sem orçamento de mesmo número: relação meramente observacional, não bloqueante;
- **9** projetos de instalação sem projeto de produção correspondente: todos possuem lote pai confirmado;
- **37** referências de orçamento ausentes: possuem pedido vendido com o mesmo número;
- **4** relações com referência `0`: sem vínculo externo válido a perseguir;
- **31** ocorrências permanecem como pendência real de revisão.

As 31 pendências reais estão concentradas em **13 números de orçamento** que não estão presentes nem em `orcamentos` nem em `pedidos` no staging atual.

Regra de segurança: somente as ocorrências classificadas como `pendente_revisao` devem entrar em fila de investigação. As demais ausências continuam auditáveis, mas não devem bloquear a migração por si só.

### Painel Master

O painel:

```
/configuracoes/integracoes/wvetro/migracao-operacional
```

mostra:

- carga persistida do Neon;
- fila de clientes CL;
- auditoria de relações;
- filtros por módulo, relação, situação, confiança e tratamento;
- diferença entre ausência bruta e pendência real;
- busca e paginação.

Todo esse fluxo permanece em modo de conferência. Não há promoção automática Neon -> Supabase.
