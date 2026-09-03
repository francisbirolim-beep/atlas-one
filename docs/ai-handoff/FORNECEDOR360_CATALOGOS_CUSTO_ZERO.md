# Fornecedor 360 — Catálogos e estratégia de custo baixo

## Objetivo

Permitir guardar catálogos/documentos por fornecedor, extrair conteúdo textual sem custo de modelo quando possível, reconciliar itens com o catálogo Atlas e cadastrar itens novos como pendentes de validação.

## Estratégia de custo

1. Upload/armazenamento: Supabase Storage já existente.
2. PDF textual: extração local com `pdf-parse` (sem chamada a modelo de IA).
3. Reconciliação simples: código normalizado e descrição, em regras locais.
4. Itens novos: cadastro como `status_validacao = pendente` e `ativo = false` até revisão humana.
5. PDF escaneado/imagem/desenho complexo: fica como `precisa_analise_ia`; não dispara provider pago automaticamente.
6. Modo custo zero assistido: o usuário pode analisar o arquivo no ChatGPT e importar/colar o JSON estruturado no Fornecedor 360, sem consumo de API pelo Atlas.
7. Futuro modo automático pago: provider externo apenas por ação explícita e com estimativa de custo antes de executar.

## Regra de segurança técnica

Nenhum item extraído automaticamente vira produto ativo, fórmula, componente de produção ou regra técnica oficial sem validação humana.
