# Kanban Geral do Atlas One — melhorias solicitadas em 10/11/2026

## Escopo aprovado para desenvolvimento (não para publicar)

### 1. Personalização de colunas — apenas Master
- Mostrar **+ Adicionar coluna** no final do quadro; nome obrigatório.
- Editar nome, descrição e cor de colunas atuais e novas.
- Arrastar e soltar as colunas para mudar a ordem; manter a sequência compartilhada no Cliente 360 e no Kanban da obra.
- Preservar os critérios operacionais e o mapeamento persistido; uma coluna visual nova pode começar vazia.
- Não excluir nem migrar cards silenciosamente quando colunas forem editadas.

### 2. Cards compactos com informações úteis
- Retirar a imagem grande **somente dos cards do Kanban Geral**.
- Manter imagens nas fichas/cadastros de perfis, vidros, acessórios e nos detalhes de compras.
- Mostrar cliente, orçamento, obra quando disponível, status da etapa, informações de materiais, prazo, avisos e acesso ao detalhe.
- Priorizar leitura rápida, sem esconder pendências e sem perder os dados já existentes.

### 3. Status personalizáveis por etapa
- Master cria, renomeia, desativa/reordena status que pertencem a cada coluna.
- Funcionário com autorização de edição/movimentação pode marcar/desmarcar **vários status simultâneos** no card.
- Exemplos: Validação de Projeto: "Em validação", "Projeto validado"; Separação: "Perfis", "Vidros", "Acessórios"; Compras: "Em cotação", "Aguardando aprovação", "Pedido realizado".
- Selecionar um status **não** muda a etapa nem emite pedido, baixa estoque, encerra produção ou altera a fonte operacional.
- Cada mudança registra usuário, data, colunas/status anteriores e novos, com controle de empresa.
- Apresentar o mesmo estado no Kanban Geral e no Cliente 360 da venda/obra, sem duplicar fonte de verdade.

### 4. Prazos e indicadores por coluna
- Master configura prazo opcional em **horas ou dias** para cada etapa.
- O relógio começa quando o card entra na etapa. Ao mover de etapa, inicia outro prazo; histórico anterior permanece auditável.
- Estados distintos: **branco/cinza** = sem início ou sem informação suficiente; **amarelo** = em andamento dentro do prazo; **verde** = etapa concluída dentro do prazo; **vermelho** = prazo da etapa vencido.
- Exibir prazo restante ou atraso de forma textual, acessível além da cor.
- Para etapas legadas sem timestamp confiável de entrada, NÃO inventar um prazo retroativo ou acusar atraso.
- Não confundir vencimento da etapa com data de instalação ou entrega comercial.

### 5. Segurança, compatibilidade e publicação
- Master administra colunas, status disponíveis e prazos; demais usuários somente no limite das permissões explícitas.
- Preservar a permissão "Somente visualizar" — ela não permite alteração de status.
- Compatibilidade com o Kanban Geral e com o Kanban de cada obra, Cliente 360, compras, produção, instalações, auditoria e RLS por empresa.
- Desenvolver em branch isolada, validar testes e prévia antes de liberar à produção. **Nenhuma publicação automática.**
- Regra geral do Atlas One: não quebrar o que funciona; implantar mudanças de forma controlada, sem interromper a operação.

## Sequência de implementação
1. Reutilizar infraestrutura de colunas já existente; acrescentar metadados opcionais (descrição, cor, prazo e opções de status).
2. Compactar os cards no Kanban Geral e manter as fotos de produtos nos detalhes.
3. Persistir seleção multi-status por card/venda/etapa com auditoria e autorização no servidor.
4. Calcular prazo com timestamp de entrada e estados visuais; propagar leitura compartilhada ao Cliente 360.
5. Testar regressão, migração isolada, permissões, sincronização e demonstrar a prévia antes de qualquer deploy final.
