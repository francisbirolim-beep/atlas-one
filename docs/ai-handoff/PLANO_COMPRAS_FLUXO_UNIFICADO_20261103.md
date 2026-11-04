# Atlas One — Compras: fluxo de entrada unificado (03/11/2026)

## Solicitação do usuário
Ao iniciar a compra por Compras 360, Adicionar Necessidade (Avançado), ou Solicitar Compra (Simples), o primeiro passo é escolher o destino do pedido. É necessário importar uma lista de perfis por PDF ou selecionar produtos manualmente. Após confirmação, acompanhar no Kanban de Compras e também no Cliente 360.

## Fluxo funcional aprovado para especificação (não implementado)
1. Abrir qualquer uma das entradas de compra existentes. Preservar atalhos, filtros, permissões, listas, cotações e telas em operação.
2. Etapa 1 — destino principal: **Estoque** ou **Cliente**.
3. Para Estoque: unidade/local de destino (quando aplicável), motivo/observações.
4. Para Cliente: localizar cadastro (nome, código ou apelido); então oferecer três opções distintas:
   - **Usar obra existente**: selecionar obra pertencente ao cliente.
   - **Criar nova obra**: usar o cadastro legítimo de obras, retornar ao mesmo pedido após gravar.
   - **Compra avulsa sem obra**: manter cliente vinculado, campo finalidade/descrição e observações, sem criar obra fictícia.
5. Etapa 2 — entrada de itens, disponível tanto no Simples como no Avançado:
   - Escolha manual pelo catálogo (código, nome, fabricante e categoria); perfis e acessórios sempre com imagem/desenho técnico correto.
   - Anexar PDF da lista de perfis/acessórios; extrair código, descrição, quantidade e unidade; guardar arquivo original.
   - Exibir prévia **editável**: selecionar todos/alguns, remover linha, adicionar, corrigir código, substituir perfil, ajustar quantidade e unidade.
   - Fazer conciliação com catálogo; registrar divergência, item desconhecido, possíveis duplicados e produto sem imagem para correção, nunca inventar correspondência/imagem.
   - Não emitir compra automaticamente da extração: revisão humana e confirmação são obrigatórias.
6. Etapa 3 — conferir cabeçalho, destino, todos os itens, fotos, valores disponíveis e observações. Gerar solicitação numerada uma única vez.
7. Após a solicitação, criar/mostrar card no Kanban de Compras, sem confundir solicitação com pedido de compra efetivamente emitido ao fornecedor.
8. Para pedido vinculado a cliente, apresentar card correspondente no Cliente 360; para obra, mostrar obra; para avulso, mostrar “Pedido avulso — sem obra”.
9. O card acompanha Solicitação → Identificação/Cotação → Aprovação → Pedido emitido → Aguardando entrega → Recebimento parcial/total, com histórico de alterações, responsável, datas, itens e acesso ao detalhe.
10. Caso o material avulso represente nova cobrança ao cliente (ex.: espelho após obra concluída), permitir criar **venda avulsa** vinculada ao cliente e ao pedido, como ação opcional e explícita. Compra NÃO cria venda/contas a receber automaticamente.
11. Recebimento movimenta estoque apenas depois da conferência; manter vínculos com fornecedores, NF, entrega parcial, local/obra, financeiro e auditoria existentes.

## Situação técnica confirmada na leitura de 03/11/2026
- `app/compras/page.tsx`: formulário avançado exige cliente + obra no destino `obra`; tem busca de catálogo.
- `app/compras/solicitacoes/page.tsx`: formulário simples aceita vários itens e fotografias, mas também exige obra ao selecionar cliente. Tem Kanban.
- `components/compras/ComprasClienteCards.tsx`: componente existente de histórico do cliente, já presente no Cliente 360.
- `app/api/compras/solicitacoes/route.ts` e migrations: validações de cabeçalho/itens e restrições no banco aceitam `obra` apenas com `cliente_id` e `obra_id`. Não basta mexer no formulário para suportar avulso.
- `app/api/vendas/materiais/compra-pdf/route.ts`: já usa `pdf-parse`, mas é específico de venda/obra/pacote técnico; não atende diretamente PDF avulso de compras.
- Fluxo por fornecedor e recebimentos já existem: integrar sem substituí-los.

## Regras técnicas de execução
- Usar um componente compartilhado de abertura/revisão nos dois caminhos. Preservar permissões, isolamento `empresa_id` e auditoria.
- Desenhar migração retrocompatível para destino `cliente_avulso` (cliente obrigatório, obra nula); manter válidos os pedidos históricos `estoque` e `obra`.
- Confirmar comportamento dos triggers, queries, filtros, Kanban, histórico do cliente e recebimento antes de alterar restrições.
- Enviar PDF apenas para análise, em armazenamento privado, validando tipo/tamanho, consentimento/visibilidade por empresa e descartando duplicatas.
- A correspondência com produto deve ser conferida; apresentação de perfis e acessórios sempre com imagem real ou indicador explícito de pendência que bloqueie validação final até correção do cadastro.
- Salvar alteração ou substituição de item e imagem com histórico. Nunca multiplicar solicitações por clique repetido.
- Lançamento de compra, recebimento e venda não deve gerar lançamentos financeiros duplicados.
- Implementar em branch/worktree isolado; testar e gerar preview sem trocar processo ativo. Publicar com rollout controlado e possibilidade de rollback, somente após homologação/autorização.

## Casos mínimos de homologação
1. Estoque + perfil escolhido manualmente (Simples e Avançado).
2. Cliente + obra existente; acesso a partir do Cliente 360.
3. Cliente sem obra + criação de obra + retorno para a solicitação.
4. Cliente sem obra + pedido avulso (sem obra fictícia), visível no cliente e Kanban.
5. Cliente com obra encerrada + item extra vendido avulsamente, compra e venda vinculáveis sem lançamento financeiro automático.
6. PDF de várias páginas: linhas identificadas, selecionar todas/algumas, editar quantidades e substituir perfis.
7. PDF com código desconhecido, imagem incorreta, duplicatas ou extração incompleta → correção manual antes de confirmar.
8. Pedido enviado aparece uma vez no Kanban e no Cliente 360, com status sincronizados.
9. Recebimento parcial e NF vinculada não duplicam estoque, financeiro ou pedido.
10. Regressões: pedidos legados, carrinhos por fornecedor, permissões e filtros por empresa continuam intactos.

**Status:** especificação preparada em worktree isolado. Nenhuma funcionalidade modificada, migração aplicada ou publicação efetuada.
