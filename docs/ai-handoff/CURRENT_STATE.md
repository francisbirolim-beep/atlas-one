# CURRENT_STATE.md — Atlas One

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
