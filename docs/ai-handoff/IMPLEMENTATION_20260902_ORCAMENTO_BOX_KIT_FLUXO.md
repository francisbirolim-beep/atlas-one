# Orçamento: fluxo simplificado, Box, Kit e correção do Kanban

Data: 2026-09-02
Branch: `feat/orcamento-box-kit-fluxo`
PR: #315

## Objetivo
Simplificar o preenchimento do Pedido de orçamento sem tornar Linha/Tipologia obrigatórias e tratar corretamente os casos de Box e Kit.

## Implementado
- ordem operacional do item: Ambiente → Descrição livre → Pesquisa de tipologia → Linha/Modelo → medidas;
- Linha, Modelo/Tipologia e pesquisa de tipologia são opcionais;
- pesquisa por digitação para Linha e Modelo/Tipologia;
- descrição livre permanece salva mesmo quando uma referência técnica é escolhida depois;
- campo separado de quantidade de folhas deixa de aparecer neste fluxo simplificado;
- Box de Canto possui largura esquerda, largura direita e altura;
- Box de Canto não pode avançar sem as duas larguras;
- Linha técnica `BOX` consolidada na base e associada às tipologias de box;
- tipologias Atlas adicionadas: `Box Frontal` e `Box de Canto`;
- categoria principal `Kit` adicionada ao cadastro de produto, Balcão e Catálogo Técnico;
- novos pedidos procuram explicitamente a coluna `Fazer orçamento`, usando a primeira coluna somente como fallback;
- digitação móvel aprimorada: campos textuais usam autocorreção/autocapitalização do aparelho e os campos Ambiente e Descrição livre possuem sugestões tocáveis para preenchimento rápido.

## Caso real auditado — Rogério
O orçamento de `ROGERIO LUCIANO` foi criado em `Orçamento feito` e, 48 segundos depois, movido manualmente para `Fazer orçamento`. O código agora deixa de depender exclusivamente da ordenação do Kanban na criação do pedido.

## Dados mestres
Foram incluídos sem mudança de schema:
- Linha `BOX`;
- `Box Frontal`;
- `Box de Canto`;
- vínculos das tipologias de categoria box à Linha BOX.

## Kit
A categoria `Kit` está disponível para cadastro e venda.

Não foi criada fórmula automática de composição Kit + Vidro nesta etapa porque os kits reais ainda precisam ser cadastrados/validados com seus códigos, unidades e regras comerciais.

## Validação manual
- texto livre sem Linha/Tipologia;
- pesquisa de Linha por texto;
- pesquisa de Modelo/Tipologia por texto;
- Box Frontal;
- Box de Canto com duas larguras;
- Kit no cadastro/Balcão/Catálogo Técnico;
- novo Pedido deve nascer em `Fazer orçamento`;
- no celular, digitar `WC`, `Sala` ou `Porta de...` e tocar em uma sugestão deve preencher o campo.
