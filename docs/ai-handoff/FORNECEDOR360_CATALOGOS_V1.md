# Fornecedor 360 — Catálogos V1

Branch: `feat/fornecedor-360-catalogos-v1`

Dependência: PR #319 (`feat/ia-aprendizado-atlas-v1`).

## Fluxo

1. Abrir Fornecedor 360.
2. Entrar em `Catálogos e produtos`.
3. Subir PDF, imagem ou documento.
4. PDF com texto: `pdf-parse` extrai localmente e tenta identificar linhas com código/descrição sem provider de IA.
5. Código já cadastrado: reutiliza produto Atlas e cria/atualiza `produto_fornecedores`.
6. Código novo com boa evidência: cria produto inativo com `status_validacao = pendente`, preservando o documento como origem.
7. Preço encontrado/importado atualiza o vínculo do fornecedor e gera histórico em `produto_fornecedor_precos_historico`.
8. PDF escaneado/imagem/arquivo visual: fica `precisa_analise_ia`; não chama provider pago automaticamente.
9. O usuário pode analisar o arquivo no ChatGPT e importar o JSON estruturado no próprio Fornecedor 360. Esse caminho gera custo de modelo igual a zero dentro do Atlas.

## Regra

Produto novo vindo de catálogo nunca entra ativo automaticamente. Precisa de validação antes de ficar disponível operacionalmente.
