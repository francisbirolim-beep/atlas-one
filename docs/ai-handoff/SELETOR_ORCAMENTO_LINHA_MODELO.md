# Seletor de orçamento — Linha → Modelo → Projeto

## Referência operacional validada

O fluxo desejado para o Atlas segue o conceito observado no W.Vetro, mas com interface própria do Atlas:

1. selecionar a **Linha** (ex.: Suprema);
2. selecionar o **Modelo/Tipologia** (ex.: Porta de Correr 03 Folhas);
3. listar em **cards visuais** todas as configurações/projetos disponíveis para a combinação selecionada;
4. escolher um card;
5. levar ao item do orçamento a configuração técnica vinculada, preservando receita, variáveis e validações.

## Regras

- a Linha deve filtrar os modelos disponíveis;
- o Modelo deve filtrar as configurações exibidas;
- quando a tipologia base possuir variável `folhas`, o seletor apresenta o modelo como `Tipologia + N folhas`;
- os cards priorizam configurações explicitamente validadas e liberadas para orçamento;
- quando a configuração estiver vinculada a um produto com `foto_url`, usar essa imagem no card;
- sem imagem, exibir placeholder neutro; não inventar desenho técnico;
- não inferir vínculo Linha/Tipologia/Produto por nome;
- vínculos devem vir das tabelas técnicas existentes (`linhas_tecnicas`, `linha_tipologias`, `linha_produtos`, configurações validadas);
- manter busca textual e modo assistido como fallback, sem substituir o fluxo principal;
- nenhuma migration nova é necessária apenas para a primeira versão da interface.

## Implementação desta etapa

- `SeletorEsquadriaInteligente` passou a exibir Linha e Modelo em seletores separados;
- modelos são derivados das configurações validadas, agrupando por tipologia + quantidade de folhas quando disponível;
- ao escolher o modelo, o Atlas mostra os projetos/configurações compatíveis em cards;
- cards usam a foto do produto vinculado quando cadastrada;
- escolha do card continua carregando o snapshot/variáveis da configuração validada;
- pesquisa textual e configuração assistida continuam disponíveis como fallback.

## Cadastro relacionado — etapa separada

- remover `Produto pronto` da tela principal do Cadastro sem apagar registros legados;
- reposicionar `Nova categoria` para não ficar misturada no meio das categorias;
- ao entrar em `Produto`, priorizar seleção de Linha e então exibir produtos daquela linha.
