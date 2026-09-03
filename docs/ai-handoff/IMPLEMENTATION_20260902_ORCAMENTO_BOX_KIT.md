# Implementação — Orçamento livre, Box, Kit e entrada no Kanban

Data: 2026-09-02
Branch: `feat/orcamento-box-kit-fluxo`

## Objetivo

Ajustar o pedido de orçamento para funcionar mesmo com o catálogo técnico ainda incompleto, melhorar a pesquisa de Linha/Tipologia, tratar Box de Canto com duas larguras, criar a categoria comercial `Kit` e impedir que novos pedidos sejam criados diretamente em `Orçamento feito`.

## Fluxo do item de orçamento

Ordem aprovada:

1. Ambiente (opcional);
2. Descrição livre da esquadria (opcional e suficiente para continuar);
3. Pesquisa de tipologia (opcional);
4. Linha pesquisável por digitação;
5. Modelo/Tipologia pesquisável por digitação;
6. medidas, quantidade, fotos e observações.

A escolha de Linha/Tipologia não bloqueia o pedido. A descrição livre continua sendo preservada quando o vendedor também escolhe uma referência técnica.

O campo separado `Quantidade de folhas` deixa de ser exibido nesse fluxo simplificado. Quantidade/configuração de folhas pode ser informada na descrição livre e, futuramente, pelas variáveis técnicas da tipologia.

## Box

Foi criada na base técnica a Linha `BOX`, sem associação à Linha Suprema.

Tipologias Atlas adicionadas:

- `Box Frontal`;
- `Box de Canto`.

Também foram vinculadas à Linha BOX as tipologias de box que já existiam na base.

### Medidas

- Box Frontal: largura + altura;
- Box de Canto: largura esquerda + largura direita + altura.

No Box de Canto, o orçamento só passa pela validação de medidas quando as duas larguras estiverem preenchidas. As dimensões específicas ficam preservadas no snapshot de `variaveis` do item (`largura_esquerda_mm`, `largura_direita_mm`, `altura_mm`, `atlas_medida_layout=box_canto`).

## Cadastro de produtos — Kit

`Kit` passa a ser categoria principal de produto, ao lado de Perfil, Acessório, Vidro e Produto pronto.

Como as categorias de produto do Atlas usam chave textual dinâmica, não foi necessária alteração de schema. A categoria passa a aparecer automaticamente no cadastro de produtos e no filtro do orçamento de balcão. O Catálogo Técnico ganhou também o grupo visual `Kits`.

Exemplo previsto: `Kit Box`, que posteriormente poderá participar da composição técnica `Kit + Vidro`. Esta etapa não cria ainda uma regra automática de composição/custo.

## Correção do caso Rogério

Caso real verificado no banco: o orçamento de `ROGERIO LUCIANO` (`3bdff31e-1c87-42fd-9fe9-155ec5e60642`) nasceu em `Orçamento feito` e foi movido manualmente para `Fazer orçamento` 48 segundos depois.

Correção: `primeiraColunaId()` passa a procurar explicitamente a coluna normalizada `Fazer orçamento`; a primeira coluna por ordem fica apenas como fallback. Assim, alterações futuras na ordem do Kanban não devem fazer um pedido novo nascer em uma etapa incorreta.

## Dados mestres criados em produção

Sem alteração de schema:

- Linha técnica `BOX`;
- Tipologia `Box Frontal`;
- Tipologia `Box de Canto`;
- vínculos das tipologias ativas da categoria `box` com a Linha BOX.

Os inserts foram feitos de forma idempotente e verificados por consulta após a gravação.

## Arquivos principais

- `components/orcamento/SeletorEsquadriaInteligenteV4.tsx`
- `components/orcamento/SeletorEsquadriaInteligenteV5.tsx`
- `components/orcamento/SeletorEsquadriaInteligente.tsx`
- `lib/produtos.ts`
- `app/cadastro/catalogo-tecnico/page.tsx`
- `lib/kanban.ts`

## Validação necessária antes de merge

1. criar item usando somente descrição livre;
2. pesquisar `Suprema` em Linha;
3. pesquisar `porta giro` em Modelo/Tipologia;
4. pesquisar/selecionar Linha `BOX`;
5. testar Box Frontal com uma largura e uma altura;
6. testar Box de Canto com largura esquerda + direita + altura e confirmar bloqueio se faltar uma das larguras;
7. confirmar categoria `Kit` no cadastro de produtos;
8. confirmar filtro `Kit` no Balcão;
9. criar pedido de teste e verificar que nasce em `Fazer orçamento`.

Não fazer merge antes da validação do usuário no Preview.
