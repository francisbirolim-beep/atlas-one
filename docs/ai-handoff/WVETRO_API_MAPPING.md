# Mapeamento API Wvetro -> Atlas One

Documento de referencia para extracao de dados do sistema Wvetro (ERP atual da empresa) e importacao no Atlas One. Gerado a partir da documentacao Postman publica: https://documenter.getpostman.com/view/26205597/2sB34kFfGz

Base URL: https://api.wvetro.com.br/wvetro/rest/api/v2

IMPORTANTE: os exemplos de resposta na documentacao publica usam dados fake (Lorem Ipsum). Os nomes e tipos de campo sao reais, os valores de exemplo nao sao.

## Autenticacao

GET /Integracao/ValidarUsuario?Licencaid=<numeric>&Secusername=<string>&Secuserpassword=<string>

Retorna um token JWT valido por 24h, que deve ir no header "token" de toda chamada seguinte.

## 1. Catalogo de produtos (perfil / acessorio / esquadria)

GET /Produtos/produtoByKey?Produtotipo=<A|P|E>&Produtocodigo=<string>

Produtotipo distingue: A = Acessorios, P = Perfil, E = Esquadria.

Campos: ProdutoCodigo, ProdutoSeuCodigo, ProdutoDescricao, ProdutoAtivo, LinhaId, LinhaNome, EspecieId, EspecieNome, TipoId, TipoNome, Unidade, ProdutoNCM, URL, ProdutoTipo.

GET /Produtos/linhas -> lista de linhas de produto (LinhaId, LinhaNome).

GET /Produtos/cores -> cores/nucleos (CorNome, CorEspessura, CorVidroPeso, CorNCM, CorInativa). O mesmo endpoint/schema aparece duplicado como "vidros" na doc (possivel artefato de copia).

Mapeamento Atlas: alimenta a tabela/tela de Produtos (app/cadastro/produtos). Puxar por Produtotipo=P e Produtotipo=A separadamente para montar os catalogos de perfil e acessorio.

## 2. Tipologias (Linha + Modelo)

O Wvetro nao tem uma tabela de "tipologia" isolada. O equivalente e o par Linha + Modelo dentro de cada item de venda (ex: Linha "L.GOLD", Modelo "Janela de correr 2 folhas"), encontrado em Vendas/pedidos e Vendas/orcamentos.

Estrategia de extracao: puxar um periodo largo de pedidos/orcamentos e extrair os pares (Linha, Modelo) unicos -> vira a base para popular a tabela tipologias do Atlas.

## 3. Composicao (BOM) de cada esquadria vendida -- endpoint mais valioso

GET /vendas/pedidos?Dtvendainicial=<date>&Dtvendafinal=<date>
GET /vendas/orcamentos?Dtcadastroinicial=<date>&Dtcadastrofinal=<date>

Mesmo schema de resposta nos dois (a doc chama o corpo de "ListPedidos" em ambos). Cada pedido/orcamento tem um array Itens[], e cada item tem:

- Linha, Modelo (mapeiam para tipologia)
- Largura, Altura, Qtde, ValorTotal
- Perfil[]: SeuCodigo, Codigo, Nome, Cor, Medida, Qtde, CustoVlr, VendaVlr, Ncm, Posicao, Corte
- Acessorios[]: SeuCodigo, Codigo, Nome, Cor, Qtde, CustoVlr, VendaVlr, Ncm
- Vidros[]: Codigo, Especificacao, Largura, Altura, Qtde, M2, TipoFixacao, Lado, Posicao, CustoVlr, VendaVlr, Ncm

Tambem existe pedidoPorChave (detalhe de um pedido especifico).

Mapeamento Atlas: e a fonte para reconstruir, item a item, quais perfis/acessorios/vidros compoe cada tipologia -- usar para sugerir/popular a composicao de tipologias no Atlas.

## 4. Pessoas (clientes / fornecedores / vendedores)

GET /pessoa/listPessoa?Pessoaid=<numeric>&Tipopessoa=<string>
POST /pessoa/createPessoa

Campos incluem PessoaRazaoSocial, PessoaFantasia, PessoaComplemento, PessoaBairro (endereco completo).

GET /pessoa/listVendedor, POST /pessoa/createVendedor -> vendedores/fornecedores.
GET /pessoa/listTipo, POST /pessoa/createTipos -> tipos de cliente.

Mapeamento Atlas: alimenta o modulo de Clientes (app/clientes) e Fornecedores.

## 5. Estoque

POST /estoque/movimentoEstoque -> corpo sdtMovimentoEstoque[]: MovimentoEstoqueDocumento, ProdutoId, MovimentoEstoqueAltura, MovimentoEstoqueLargura, PessoaId, CorEstoqueId, MovimentoEstoqueQtde, MovimentoEstoqueValor.

Movimentacao por produto + cor + dimensao (entrada/saida). Util se quisermos trazer saldo de estoque de perfil/acessorio para o Atlas no futuro.

## 6. Compras

GET /compras/nf?Dtentradainicio=<date>&Dtentradafinal=<date> -> notas de entrada.
GET /compras/itemNf?Nfid=<numeric> -> itens de uma NF especifica.

Util para cruzar custo de compra por produto.

## 7. Fora de escopo (nao relevante para perfil/acessorio/tipologia)

- Financeiro: listContas, listPlanoContas, listTitulos -- controle financeiro interno, sem relacao com produto.
- Producao: lotes, producaoProjeto, instalacoes -- controle de producao/instalacao/equipes, nao traz composicao de produto.
- Vendas/listaMetas, criarMeta -- metas de vendedor.

## Plano de extracao sugerido

1. Puxar Produtos/produtoByKey filtrado por Produtotipo=P e Produtotipo=A para montar os catalogos de perfil e acessorio no Atlas.
2. Puxar Vendas/pedidos (ou orcamentos) de um periodo largo e extrair os pares unicos de Linha+Modelo -> tipologias novas.
3. Para cada tipologia, usar os arrays Perfil[]/Acessorios[]/Vidros[] dos itens correspondentes para sugerir a composicao.

## Status

Documentacao da API mapeada em 16/08/2026. Extracao de dados reais depende de credenciais validas da API Wvetro (Licencaid, Secusername, Secuserpassword), ainda nao fornecidas neste momento -- ver NEXT_TASK.md.
