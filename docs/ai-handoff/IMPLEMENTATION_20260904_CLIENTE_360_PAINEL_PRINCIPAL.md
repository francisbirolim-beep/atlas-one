# Cliente 360 — painel principal

Data: 2026-09-04

## Objetivo

Transformar `/clientes/[id]` no painel operacional completo do cliente, em vez da tela antiga focada em cadastro/CRM.

## Implementação

- `/clientes/[id]` passa a renderizar `Cliente360Dashboard` como visão principal;
- o painel já consolida cliente, obras, orçamentos sob medida e balcão, vendas balcão, assistências, medições, documentos, interações, contas a receber e recebimentos;
- indicadores mostram posição financeira, recebido, a receber, vencido, obras e assistências;
- Financeiro permite registrar recebimento pelo cliente e por obra;
- quando um recebimento é vinculado a uma obra, a função existente `alocar_recebimento_cliente_em_obra` aplica o valor nas parcelas abertas por ordem de vencimento, permitindo recebimento parcial ou total sem criar lançamento financeiro paralelo;
- permanecem disponíveis criação de obra, orçamento, balcão, assistência, documentos, histórico e IA do cliente.

## Compatibilidade

A rota `/clientes/[id]/central` continua existindo. Nenhuma migration foi criada nesta alteração, pois a estrutura financeira e o painel 360 já estavam implementados e validados no código existente.
