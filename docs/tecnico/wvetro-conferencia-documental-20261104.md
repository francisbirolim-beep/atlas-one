# Conferência documental W.Vetro — composição, materiais e aprendizado supervisionado

## Entrada e verificação
- A composição inicial vem do pacote técnico W.Vetro já importado na obra.
- Em **Tipologias**, cada peça pode abrir sua composição, imprimir ficha individual ou entrar em uma impressão múltipla, mantendo cada peça em página própria.
- Em **Materiais**, a lista consolidada tem uma conferência documental independente.
- O Master pode marcar os dados importados como corretos; ou carregar um PDF de referência, abrir o arquivo, pedir análise assistida e conferir as sugestões antes de validar.
- O PDF recebido deve ser pesquisável e ter até 15 MB, máximo de 80 páginas. Se o número de orçamento aparece no PDF, tem de conferir com o número da venda W.Vetro.
- A validação exige justificativa e confirmação humana de que o documento pertence à obra; o PDF é guardado em bucket privado. O documento e a assinatura da lista técnica são preservados com responsável e data.

## Aprendizado e precauções
- Dados documentais validados são entradas **concluídas** da Central de Aprendizado, com evento de auditoria e metadados `wvetro_conferencia`.
- O analisador só usa exemplos de correções anteriores aprovadas da mesma empresa e mesmo tipo de documento; usa códigos e observações, **nunca quantidades de outra obra**.
- As sugestões do modelo não mudam receitas, fórmulas, perfis, estoque ou compras. Para aplicar uma mudança, o Master usa o editor técnico da tipologia; depois precisa conferir materiais e futuras cotações.
- Se a composição técnica muda, a assinatura não confere e o sistema sinaliza **revisão necessária**.
- Plano de corte (peças) não deve ser usado como relação de barras comerciais para compra. O fluxo de Barras Utilizadas existente é preservado.
- Relatórios de perfil e acessório exibem a imagem cadastrada por produto ou código correspondente. Se não houver imagem, mostrar **imagem pendente**, sem atribuir imagem semelhante.

## Pontos técnicos
- API: `app/api/vendas/wvetro/conferencia-documental/route.ts`.
- Interface: `components/clientes/VendaConferenciaDocumentalWVetro.tsx`.
- Impressão das fichas: `app/obras/[id]/tipologias/fichas/page.tsx`.
- Integração: `components/clientes/VendaTipologiasMateriais.tsx` e `VendaObraCentral.tsx`.
- Reaproveita `ai_aprendizado_entradas`, `ai_aprendizado_eventos` e o bucket privado `atlas-aprendizado`; sem migração de tabela nova.

## Homologação pendente
- Confirmar a extração e o layout usando o PDF real do W.Vetro do orçamento 236, sem registrar alterações reais antes de verificar documento e correspondências.
- O atual fluxo registra um PDF como evidência validada, mas **não aplica automaticamente suas quantidades como correção da tipologia**. Essa alteração continua explícita no editor da obra.
- Antes de produção: testar com usuários autorizados, PDFs incompatíveis, PDF sem texto, anexos repetidos, mudança de composição após validação e impressão com muitos materiais.
