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
- quando a tipologia base possuir variável `folhas`, o seletor pode apresentar o modelo como `Tipologia + N folhas`;
- os cards devem priorizar configurações explicitamente validadas e liberadas para orçamento;
- quando a configuração estiver vinculada a um produto com `foto_url`, usar essa imagem no card;
- sem imagem, exibir placeholder neutro; não inventar desenho técnico;
- não inferir vínculo Linha/Tipologia/Produto por nome;
- vínculos devem vir das tabelas técnicas existentes (`linhas_tecnicas`, `linha_tipologias`, `linha_produtos`, configurações validadas);
- manter busca textual e modo assistido como fallback, sem substituir o fluxo principal;
- nenhuma migration nova é necessária apenas para a primeira versão da interface.

## Cadastro relacionado

Em tarefa separada:
- remover `Produto pronto` da tela principal do Cadastro sem apagar registros legados;
- reposicionar `Nova categoria` para não ficar misturada no meio das categorias;
- ao entrar em `Produto`, priorizar seleção de Linha e então exibir produtos daquela linha.
