# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — HOME RESPONSIVA + TEMA CLARO POR USUÁRIO — 2026-08-21

A tela inicial foi ajustada a partir do caso real da usuária Keila em largura intermediária de desktop, onde o bloco principal ficava comprimido e o título quebrava praticamente uma palavra por linha.

Estado atual desta implementação:
- `components/system/HomeExecutiveHero.tsx` só passa para o layout de duas colunas em `xl`; em larguras menores, texto e ações ficam empilhados e usam a largura disponível;
- os três atalhos (`Novo orçamento`, `Nova tarefa`, `Novo compromisso`) permanecem lado a lado a partir de `sm`, mas abaixo do texto até `xl`;
- `components/Sidebar.tsx` ganhou alternância `Tema claro` / `Tema escuro`;
- a preferência é salva por usuário no navegador usando a chave `atlas-theme:<usuario.id>`;
- o tema claro clareia a sidebar e o hero da Home, preservando o restante da interface profissional já clara;
- o tema escuro mantém a identidade atual da sidebar e do hero;
- `app/atlas-theme.css` também corrige contraste do título `Atlas One` e do nome do usuário na sidebar escura;
- nenhuma migration e nenhuma alteração de banco nesta etapa.

## EM VALIDAÇÃO — ORÇAMENTO COM TIPO LIVRE — 2026-08-21

O formulário de Orçamento Rápido agora permite cadastrar uma esquadria mesmo quando Linha / Modelo / Tipologia ainda não existem no catálogo técnico.

Estado atual desta implementação:
- `components/orcamento/SeletorEsquadriaInteligente.tsx` ganhou o campo **Tipo de esquadria / descrição livre**;
- ao preencher esse campo, o item passa a usar `tipo = outro` e grava a descrição em `tipoOutroTexto`, estrutura que já existia no orçamento;
- Linha e Modelo / Tipologia aparecem explicitamente como opcionais;
- o vendedor pode deixar Linha e Modelo vazios e enviar o orçamento usando apenas a descrição livre + demais campos obrigatórios do pedido;
- se o vendedor quiser informar uma Linha conhecida junto com a descrição livre, a troca da Linha preserva o texto digitado;
- ao escolher uma Tipologia cadastrada, o fluxo volta para o catálogo e limpa a descrição livre para evitar conflito;
- nenhuma migration e nenhuma alteração de banco nesta etapa.

Também permanece válido o estado anterior do Plano de Corte PC3: SU289/SU290 vinculados às figuras exatas do W.Vetro nº 994; TMC ainda precisa de figura técnica exata validada.
