# Próxima validação — Orçamento / Box / Kit

Validar no Vercel Preview da branch `feat/orcamento-box-kit-fluxo` antes de mergear:

1. Pedido de orçamento aceita somente descrição livre, sem Linha ou Tipologia.
2. Linha permite digitar e filtrar, por exemplo `Suprema`.
3. Modelo/Tipologia permite digitar e filtrar, por exemplo `porta giro`.
4. Linha BOX aparece separada da Suprema.
5. Box Frontal usa largura + altura.
6. Box de Canto usa largura esquerda + largura direita + altura e não permite seguir faltando uma das larguras.
7. Cadastro de Produtos oferece categoria Kit.
8. Orçamento Balcão oferece filtro Kit.
9. Novo pedido entra em Fazer orçamento e não em Orçamento feito.

Depois da validação do usuário, atualizar o handoff principal e decidir merge.
