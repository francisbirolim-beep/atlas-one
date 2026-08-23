# DANFE PDF v2 — diagnóstico em validação

Data: 2026-08-23

Após validação real de PDF/DANFE no módulo Compras, o cabeçalho passou a ser lido corretamente (número, série, emissão, fornecedor e total), porém um modelo real ainda retornou zero itens e CNPJ vazio.

Ajustes desta rodada:
- novo parser `lib/danfePdfParserV2.ts`;
- amplia reconhecimento do título da seção de produtos/serviços;
- se a seção não for localizada ou não render itens, faz fallback somente-leitura procurando padrões de item no texto inteiro do PDF;
- amplia janela de reconstrução de linhas quebradas de produto;
- amplia reconhecimento de `CNPJ`, `C.N.P.J.` e `CNPJ/CPF`;
- mantém leitura em prévia sem gravação;
- quando PDF retorna zero itens, a rota registra em log apenas diagnóstico técnico da estrutura (páginas, presença de seção, quantidade de linhas, uso de fallback e amostra de linhas com NCM/CFOP), sem credenciais.

Próxima validação:
- reenviar o mesmo DANFE real na tela `/compras/entrada`;
- se ainda retornar zero itens, usar os logs da Vercel para adaptar o parser ao layout real;
- não confirmar a NF nem atualizar custo até itens/unidades/valores estarem validados.
