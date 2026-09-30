# W.Vetro -> Atlas One — Mapa Mestre de Integração e Migração Operacional

Data da revisão: 30/09/2026  
Branch de preparação: `feat/wvetro-migracao-operacional-v1`  
API fonte: Wvetro Integrations v2  
Base URL: `https://api.wvetro.com.br/wvetro/rest/api/v2`

## 1. Objetivo

Preparar a migração operacional do W.Vetro para o Atlas One sem misturar dado externo bruto com cadastro oficial, sem apagar histórico e sem escrever no W.Vetro durante a fase de migração.

Fluxo obrigatório:

```
W.Vetro API
  -> captura somente leitura
  -> staging imutável/auditável
  -> normalização
  -> reconciliação com Atlas
  -> prévia
  -> aprovação
  -> promoção idempotente para tabelas oficiais
  -> auditoria pós-migração
```

Regras fundamentais:

1. Nenhum POST/PUT/PATCH/DELETE no W.Vetro durante a migração.
2. Nenhum payload W.Vetro grava diretamente em tabela operacional Atlas sem passar por reconciliação.
3. Todo registro externo deve preservar chave externa e payload bruto.
4. Reexecutar uma janela já processada não pode duplicar clientes, obras, vendas, NF, títulos ou movimentos.
5. Nome isolado nunca é chave de deduplicação segura.
6. Referência histórica técnica W.Vetro continua separada de receita técnica Atlas validada.
7. Estoque histórico não vira saldo inicial automaticamente.
8. Vendedor W.Vetro não vira login Atlas automaticamente.

## 2. Estado atual do Atlas

Leitura do Supabase de produção em 30/09/2026:

| Tabela | Registros | Situação |
|---|---:|---|
| `clientes` | 132 | operacional |
| `obras` | 2 | operacional |
| `orcamentos` | 78 | operacional |
| `vendas_obras` | 5 | operacional |
| `fornecedores` | 2 | operacional |
| `produtos` | 2.762 | operacional |
| `compras_nfs` | 0 | destino pronto |
| `compras_nf_itens` | 0 | destino pronto |
| `historico_precos_compra` | 0 | destino pronto |
| `estoque_saldos` | 0 | destino pronto |
| `estoque_movimentos` | 0 | destino pronto |
| `financeiro_contas_pagar` | 0 | destino pronto |
| `financeiro_contas_receber` | 5 | operacional |
| `ordens_producao` | 0 | destino pronto |

Base técnica W.Vetro já existente:

| Tabela | Registros |
|---|---:|
| `wvetro_referencias_linhas` | 119 |
| `wvetro_referencias_tipologias` | 115 |
| `wvetro_referencias_componentes` | 2.823 |
| `wvetro_produtos_snapshot` | 2.481 |
| `wvetro_tipologia_componentes` | 913 |
| `wvetro_referencias_variaveis` | 59 |
| `wvetro_base_tecnica_pendencias` | 205 |

Conclusão: a migração operacional não deve reutilizar as tabelas de referência técnica como staging de clientes, vendas, financeiro ou estoque. Elas possuem finalidade diferente.

## 3. Inventário da API W.Vetro

A coleção Postman possui 32 operações. Para a migração inicial serão utilizados somente endpoints GET.

### Autenticação

`GET /Integracao/ValidarUsuario`

- retorna JWT;
- credenciais ficam apenas no servidor;
- token é reutilizado em cache e renovado em 401/403.

### Produtos / catálogo

- `GET /Produtos/linhas`
- `GET /Produtos/produtoByKey`
- `GET /Produtos/cores`
- `GET /Produtos/vidros`

### Pessoas

- `GET /pessoa/listPessoa`
- `GET /pessoa/listTipo`
- `GET /pessoa/listVendedor`

### Vendas

- `GET /vendas/listMetas`
- `GET /vendas/pedidos`
- `GET /vendas/orcamentos`
- `GET /vendas/pedidoByKey`

### Compras

- `GET /compras/nf`
- `GET /compras/itemNf`

### Estoque

- `GET /estoque/movimentoEstoque`

### Financeiro

- `GET /Financeiro/listTitulos`
- `GET /Financeiro/listTitulosBaixados`
- `GET /Financeiro/listContas`
- `GET /Financeiro/listPlanoContas`
- `GET /Financeiro/listExtrato`

### Produção / instalação

- `GET /producao/lotes`
- `GET /producao/producaoProjeto`
- `GET /producao/instalacoes`

## 4. Mapa de integração

| Fonte W.Vetro | Conteúdo | Destino Atlas | Prioridade | Regra de promoção |
|---|---|---|---|---|
| `listPessoa` | clientes, fornecedores, construtoras, dados cadastrais | `clientes`, `fornecedores` | MÁXIMA | CPF/CNPJ > telefone/e-mail > revisão |
| `listVendedor` | vendedores e comissão | `usuarios`/vínculo comercial | ALTA | vínculo manual; não cria usuário |
| `orcamentos` | orçamento, cliente, obra, endereço, custos, itens | `orcamentos`, `obras`, `vendas_obras`, `historico` | MÁXIMA | staging + cliente/obra reconciliados |
| `pedidos` | vendas confirmadas | mesmos destinos de venda | MÁXIMA | pedido prevalece como histórico vendido |
| `pedidoByKey` | detalhe pontual | conferência do histórico | ALTA | recuperação/auditoria |
| `nf` | NF entrada, fornecedor, tributos, obra/local | `compras_nfs` | ALTA | chave NFe/NFCompraId idempotente |
| `itemNf` | produto, quantidade, custo, barra/peso | `compras_nf_itens`, histórico de preço | ALTA | produto precisa estar reconciliado |
| `movimentoEstoque` | entradas/saídas por produto/cor/local/obra | `estoque_movimentos` | ALTA | histórico primeiro; saldo depois |
| `listTitulos` | contas abertas | pagar/receber | ALTA | classificar `TituloTipo` antes |
| `listTitulosBaixados` | pagamentos/recebimentos | contas + recebimentos | ALTA | vincular pelo `TituloId` |
| `listContas` | contas bancárias | configuração/referência | MÉDIA | nunca substituir configuração automaticamente |
| `listPlanoContas` | plano/centro de custo | taxonomia financeira | MÉDIA | mapear antes de promover |
| `listExtrato` | lançamentos bancários | histórico/conferência | MÉDIA | não gerar título automaticamente |
| `lotes` | lote, datas, quantidades, projetos | `ordens_producao`, histórico | ALTA | histórico concluído; ativos exigem regra |
| `producaoProjeto` | produção por projeto | produção/histórico | ALTA | relacionar ao orçamento migrado |
| `instalacoes` | programação, equipe, projetos instalados | histórico / instalação | ALTA | histórico primeiro |
| `linhas` | catálogo de linhas | linhas técnicas/referências | ALTA | já existe reconciliação |
| `cores` | cores/acabamentos | `cores` | MÉDIA | revisão de nomenclatura |
| `vidros` | catálogo publicado como vidros | referência de vidros | MÉDIA | validar payload real antes |

O arquivo executável equivalente está em `lib/wvetroOperacionalMap.ts`.

## 5. Campos de venda que precisam ser preservados

Cada orçamento/pedido possui dados suficientes para reconstruir Cliente 360 + Obra + histórico comercial.

### Cabeçalho

- `Nro`
- `DtEmissao`
- `DtVenda`
- `DtFaturamento`
- `DtVencimento`
- `ClienteCodigo`
- `ClienteNome`
- `ClienteCNPJ`
- `Situacao`
- `VendedorNome`
- `ValorBruto`
- `DescontoVlr`
- `Total`
- `CustoComSobra`
- `CustoSemSobra`
- `ComissoesVlr`
- `CustoMaoObraVlr`
- `TotalM2`

### Obra

`DadosObra` deve alimentar a reconciliação de:

- nome da obra;
- responsável;
- telefone;
- arquiteto;
- endereço de entrega;
- condomínio.

### Resumo de custos

`ResumoObra` deve permanecer íntegro no staging, incluindo:

- perfil;
- acessórios;
- vidro;
- kits;
- serviços;
- tratamentos;
- sobra;
- perda de corte;
- sucata.

### Itens

`Itens[]` deve preservar individualmente:

- `Id`;
- `Codigo`;
- `Nome`;
- `Linha`;
- `Modelo`;
- `Largura`;
- `Altura`;
- `Ambiente`;
- `Qtde`;
- `ValorTotal`;
- `Perfil[]`;
- `Acessorios[]`;
- `Vidros[]`.

Não agregar estes dados antes de salvar o snapshot operacional. A base técnica existente pode continuar agregando por tipologia, mas a migração operacional precisa manter a ocorrência individual.

## 6. Chaves e deduplicação

### Pessoa

Ordem de segurança:

1. chave externa W.Vetro `PessoaId`;
2. CPF/CNPJ normalizado;
3. telefone + e-mail;
4. nome + cidade apenas como sugestão para revisão.

Nunca efetuar merge automático por nome isolado.

### Venda/orçamento

Chave externa primária: número W.Vetro + tipo da fonte.

Exemplo lógico:

`wvetro:orcamento:12854`

e

`wvetro:pedido:12854`

Podem representar fases diferentes do mesmo negócio. A promoção deve relacioná-las em vez de apagar uma delas.

### NF

Prioridade:

1. `NFCompraChaveNFe`;
2. `NFCompraId`;
3. fornecedor + número + série + data, somente como fallback revisável.

### Produto

Índice de reconciliação já adotado no Atlas:

1. `produtos.id_externo_wvetro`;
2. `produtos.codigo_origem`;
3. `produtos.codigo`.

Mais de um candidato = divergência; nunca escolher arbitrariamente.

### Título financeiro

`TituloId` deve ser chave externa.

Baixa deve atualizar/vincular o título correspondente, não criar novo título.

## 7. Staging operacional no Neon

O staging foi movido para Neon Postgres e deve permanecer separado do Supabase operacional do Atlas.

Schema: `wvetro_migracao`.

Migration preparada: `neon/migrations/20260930_wvetro_migracao_operacional_staging.sql`.

### `wvetro_migracao.execucoes`

Controle de execução:

- id;
- recurso;
- período inicial/final;
- cursor;
- status;
- total_lidos;
- total_novos;
- total_vinculados;
- total_divergentes;
- total_erros;
- iniciado_em;
- finalizado_em;
- usuário solicitante.

### `wvetro_migracao.raw`

Snapshot imutável de origem:

- id;
- execucao_id;
- recurso;
- chave_externa;
- data_referencia;
- payload JSONB;
- payload_hash;
- capturado_em.

Índice único sugerido:

`(recurso, chave_externa, payload_hash)`

Assim o mesmo registro pode mudar no W.Vetro e ainda manter versões históricas sem duplicar cópias idênticas.

### `wvetro_migracao.vinculos`

Reconciliação:

- recurso;
- chave_externa;
- entidade_atlas;
- atlas_id;
- status: `novo | vinculado | divergente | ignorado`;
- método de match;
- confiança informativa;
- revisão humana;
- observação.

A confiança nunca autoriza sozinha uma promoção.

### `wvetro_migracao.pendencias`

Fila auditável:

- recurso;
- chave_externa;
- motivo;
- payload relevante;
- tentativas;
- status;
- resolvido_em;
- resolvido_por.

## 8. Estratégia de carga

A API W.Vetro apresentou timeout em períodos grandes. A base técnica já confirmou que o lote seguro deve ser de no máximo 7 dias.

Algoritmo:

1. dividir o intervalo em janelas de 7 dias;
2. buscar uma janela;
3. salvar snapshot;
4. calcular hash;
5. marcar execução;
6. seguir para próxima janela;
7. erro em uma janela vira pendência;
8. não reiniciar do zero;
9. reprocessar somente janelas pendentes.

Para catálogo sem filtro de data, usar lotes pequenos por código quando necessário.

## 9. Ordem da migração operacional

### Fase 0 — diagnóstico

- testar todos os GETs reais;
- registrar forma real do payload;
- confirmar valores válidos de filtros (`Tipopessoa`, `TituloTipo`, `Tipo` de estoque);
- validar `/Produtos/vidros`;
- validar `pedidoByKey`.

### Fase 1 — identidade

1. pessoas;
2. fornecedores;
3. vendedores apenas como vínculo;
4. produtos já reconciliados.

Gate: nenhum cliente existente pode ser duplicado em teste.

### Fase 2 — comercial

1. orçamentos;
2. pedidos;
3. obras;
4. itens individuais;
5. histórico Cliente 360.

Gate: número de vendas por período deve bater com W.Vetro e total financeiro deve fechar dentro de tolerância definida.

### Fase 3 — compras

1. NF;
2. itens;
3. fornecedor;
4. histórico de custo.

Gate: chave NFe sem duplicidade e soma de itens compatível com documento.

### Fase 4 — financeiro

1. títulos;
2. títulos baixados;
3. plano/centro de custo;
4. contas/extrato apenas como referência.

Gate: títulos abertos + baixados reconciliados por `TituloId`.

### Fase 5 — produção e instalação

1. lotes;
2. projetos produzidos;
3. instalações.

Gate: vincular ao orçamento antes de criar histórico operacional.

### Fase 6 — estoque

1. importar movimentos históricos;
2. validar período completo;
3. definir saldo inicial;
4. somente então calcular saldo Atlas.

Nunca derivar saldo oficial de histórico parcial.

## 10. Preview técnico já preparado

Foi criado:

`GET /api/integracoes/wvetro/migracao-operacional/preview`

Acesso: somente usuário Master.

Características:

- somente GET;
- nenhuma escrita no W.Vetro;
- nenhuma escrita no Atlas;
- retorna no máximo 20 registros de amostra;
- informa total da coleção;
- recursos históricos limitados a 7 dias;
- expõe o mapa da integração em `?recurso=mapa`.

Exemplos:

```
?recurso=mapa
?recurso=pessoas
?recurso=pessoas&tipoPessoa=<TIPO>
?recurso=orcamentos&inicio=2026-09-01&fim=2026-09-07
?recurso=pedidos&inicio=2026-09-01&fim=2026-09-07
?recurso=pedido&id=12345
?recurso=notas_entrada&inicio=2026-09-01&fim=2026-09-07
?recurso=itens_nf&nfId=123
?recurso=estoque_movimentos&inicio=2026-09-01&fim=2026-09-07
?recurso=titulos&inicio=2026-09-01&fim=2026-09-07
?recurso=titulos_baixados&inicio=2026-09-01&fim=2026-09-07
?recurso=extrato&inicio=2026-09-01&fim=2026-09-07
?recurso=lotes_producao&inicio=2026-09-01&fim=2026-09-07
?recurso=producao_projeto&inicio=2026-09-01&fim=2026-09-07
?recurso=instalacoes&inicio=2026-09-01&fim=2026-09-07
```

## 11. Segurança

- credenciais W.Vetro permanecem em variáveis de ambiente servidor;
- token W.Vetro não é enviado ao navegador;
- endpoint de preview exige Master via autenticação atual do Atlas/Supabase;
- a connection string Neon usa `NEON_STAGING_DATABASE_URL` somente no servidor;
- nunca usar variável `NEXT_PUBLIC_*` para a conexão Neon;
- o schema `wvetro_migracao` revoga acesso do papel genérico `public`;
- o navegador nunca consulta Neon diretamente;
- a flag `WVETRO_MIGRACAO_OPERACIONAL_WRITE_ENABLED` permanece desligada por padrão;
- execução de migração passa por rotas server-side e trilha de auditoria.

## 12. Critérios para liberar a primeira importação

Antes de promover qualquer dado para tabelas oficiais:

- [ ] todos os recursos prioritários respondem com payload real;
- [ ] pessoas: regra de duplicidade testada;
- [ ] vendas: período de amostra confere com W.Vetro;
- [ ] obras: endereço e responsável conferidos;
- [ ] compras: NF e itens fecham;
- [ ] financeiro: tipos de título classificados;
- [ ] estoque: nenhum saldo oficial é alterado;
- [ ] produção: histórico não cria ordem ativa indevida;
- [ ] reexecução do mesmo lote não duplica registro;
- [ ] cada registro promovido mantém referência W.Vetro;
- [ ] rollback lógico documentado;
- [ ] backup/snapshot pré-migração confirmado.

## 13. Próxima implementação

Já preparado na branch:

1. migration Neon das quatro tabelas de staging;
2. driver serverless Neon;
3. serviço `wvetroMigracaoOperacionalServer.ts` usando Neon para persistência;
4. captura idempotente por hash/versão;
5. reconciliação de Pessoas x Cliente 360;
6. painel Master de Migração W.Vetro.

Próximos gates:

1. conectar/criar o projeto Neon;
2. definir `NEON_STAGING_DATABASE_URL` apenas no Preview Vercel;
3. aplicar o schema `wvetro_migracao`;
4. testar conexão;
5. executar dry-run de Pessoas;
6. habilitar a flag de escrita somente para capturar staging;
7. repetir a mesma captura para validar idempotência;
8. depois expandir captura para Orçamentos/Pedidos;
9. somente após validação implementar promoção Neon -> Supabase oficial.
