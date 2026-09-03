# Implementações — pacote comercial 2026-09-02

Implementado na branch `feat/orcamento-box-kit-fluxo`:

- novo seletor de orçamento com descrição livre prioritária;
- pesquisa opcional de tipologia;
- Linha e Modelo/Tipologia pesquisáveis por texto;
- remoção visual do campo separado Quantidade de folhas neste fluxo;
- Linha BOX independente da Suprema;
- Box Frontal e Box de Canto;
- Box de Canto com largura esquerda, largura direita e altura;
- categoria de produto Kit;
- grupo Kits no Catálogo Técnico;
- correção da coluna inicial de pedidos para Fazer orçamento;
- documentação do caso real de ROGERIO LUCIANO que evidenciou a entrada incorreta em Orçamento feito.

Dados mestres BOX foram adicionados diretamente e de forma idempotente na base existente, sem alteração de schema.

Pendente: CI, Preview e validação manual antes do merge.
