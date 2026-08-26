# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Cliente 360 + fluxo Venda → Conferir Projeto

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge ainda.**

Referência detalhada: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

## Fluxo que deve ser preservado

### Venda confirmada

Cria somente:
1. snapshot em `vendas_obras`;
2. Financeiro / pré-lançamento em `financeiro_contas_receber`;
3. card `Engenharia — Conferir Projeto` em `A conferir`.

Não criar Medição Final, materiais, Produção ou Instalação diretamente em `Vendido`.

### Projeto conferido

Ao mover o card para `Projeto conferido`:
- criar/garantir Medição Final;
- criar/garantir Perfis;
- criar/garantir Acessórios;
- criar/garantir Outros;
- Vidros ainda não.

Perfis/Acessórios/Outros:
`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

### Medição Final aprovada

Somente aqui:
- criar/garantir Vidros;
- criar/atualizar MEE/Engenharia técnica pós-medição.

Vidros:
`Pendente → Em compra → Comprado → Aguardando entrega → Recebido → Separado → Liberado`.

## Validação manual no Preview antes do merge

1. Abrir um cliente controlado em `/clientes/[id]/central`.
2. Abrir `Andamento` e conferir agrupamento por obra, inclusive orçamentos legados com `modo_entrada` nulo.
3. Usar um orçamento sob medida com itens estruturados e mover para `Vendido`.
4. Na confirmação da venda, conferir o orçamento aprovado e clicar `Confirmar venda`.
5. Confirmar:
   - existe Financeiro;
   - existe uma única venda em `vendas_obras`;
   - abriu card em `Engenharia — Conferir Projeto / A conferir`;
   - Medição Final ainda não nasceu;
   - Perfis/Acessórios/Outros/Vidros ainda não nasceram.
6. Mover projeto para `Em conferência` e `Aguardando ajuste`: nenhum downstream deve nascer.
7. Mover para `Projeto conferido` e confirmar:
   - Medição Final criada;
   - Perfis em `Pendente`;
   - Acessórios em `Pendente`;
   - Outros em `Pendente`;
   - Vidros ainda ausente.
8. Aprovar Medição Final e confirmar:
   - Vidros em `Pendente`;
   - MEE/Engenharia técnica recebe a obra.
9. Reabrir Cliente 360 → Andamento e verificar que os mesmos estados aparecem consolidados por obra.
10. Confirmar que reprocessar os eventos não duplica venda/conta/cards.

## Já validado automaticamente

Teste transacional com `ROLLBACK` passou:
- venda 1;
- financeiro 1;
- projeto conferido 1;
- medição aprovada 1;
- perfis 1;
- acessórios 1;
- outros 1;
- vidros 1 somente pós-medição;
- MEE 1;
- todos os cards com cliente + obra;
- 0 registros de teste restantes.

O commit funcional `bd4ebb084807235c22d9c5fd0934bbc4904d399e` passou Build Validation, Supabase Database Control e Preview Vercel. Como houve commits posteriores de documentação/compatibilidade da tela Andamento, **confirmar novamente os checks do HEAD final antes de qualquer merge**.

## Próxima definição funcional com o usuário

Depois da validação deste fluxo, detalhar os gates de:

- Produção: quando nasce e quais materiais precisam estar liberados;
- Produção parcial por item/tipologia;
- Instalação: quando o card nasce e como funciona agendamento;
- Compras geral versus Kanbans específicos de Perfis/Vidros/Acessórios/Outros;
- reabertura/reprocessamento após revisão da venda ou alteração de projeto;
- controle completo de custo `Previsto → Otimizado → Comprado → Realizado` por cliente/obra/item.

## Regras invioláveis

- GitHub é fonte da verdade.
- Branch → PR → build/preview → merge manual; nunca commit direto em `main`.
- Cliente 360 consolida os mesmos registros dos setores; não duplicar status.
- Financeiro é único, filtrado/vinculado por cliente e obra.
- Venda fechada preserva snapshot; alteração posterior exige justificativa/histórico.
- Venda/Orçamento Balcão rápido não entra no Kanban de obras.
- Vidro nunca é liberado antes da Medição Final aprovada.
- MEE pós-medição não deve ser removido enquanto a conferência técnica depender de `medicao_itens`.
- W.Vetro é referência; conhecimento Atlas validado tem prioridade.
