# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Cliente 360 + gates da venda

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge ainda.**

Referência detalhada: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

## Fluxo que deve ser preservado

### Arrastar para Vendido

- abre `/vendas/confirmar`;
- NÃO persiste o card em `Vendido` antes da confirmação;
- isso evita o estado antigo “parece vendido, mas não existe venda nem financeiro”.

### Venda confirmada

Cria somente:
1. snapshot em `vendas_obras`;
2. conta em `financeiro_contas_receber` com o valor vendido + card Financeiro;
3. card `Engenharia — Conferir Projeto` em `A conferir`;
4. somente depois marca o orçamento `status='vendido'` e move para a coluna `Vendido`.

Não criar Medição Final, materiais, Produção ou Instalação diretamente em `Vendido`.

### Projeto conferido

Ao mover o card para `Projeto conferido`:
- criar/garantir Medição Final;
- criar/garantir Perfis;
- criar/garantir Acessórios;
- criar/garantir Outros;
- Vidros ainda não.

O fluxo deve funcionar também quando o orçamento ainda estiver em **Sem obra definida**.

### Medição Final aprovada

Somente aqui:
- criar/garantir Vidros;
- criar/atualizar MEE/Engenharia técnica pós-medição.

## Cliente 360 → Andamento

- usar `vendas_obras` como gate real da venda;
- cards legados criados cedo demais não podem liberar/mostrar etapas futuras antes de seu gate;
- Financeiro deve mostrar o saldo real de `financeiro_contas_receber`;
- antes de Projeto conferido, Perfis/Acessórios/Outros ficam bloqueados;
- Vidros fica bloqueado até Medição Final aprovada;
- abrir Perfis/Vidros/Acessórios/Outros pelo Andamento deve oferecer seta **Voltar** para a mesma aba do Cliente 360.

## Caso real diagnosticado — orçamento #60

Cliente: MAURICIO JOSE MOTTA CORREIA LIMA.

Estado encontrado:
- orçamento #60 = R$ 1.477,75;
- coluna histórica = `Vendido`;
- `status='enviado'`;
- não existe `vendas_obras`;
- não existe `financeiro_contas_receber`;
- cards antigos de Medição/Instalação/Financeiro foram criados cedo demais pelo fluxo legado.

Conclusão: o fluxo antigo movia visualmente para `Vendido` antes de concluir a confirmação. **Não criar conta real automaticamente** sem confirmação de que essa venda é válida. No novo Andamento, usar **Confirmar venda e gerar Financeiro** para regularizar com segurança.

## Validação automática concluída

Teste isolado de Venda confirmada:
- venda = 1;
- conta a receber = 1, com o valor do orçamento;
- Financeiro = 1;
- Conferir Projeto = 1;
- Medição = 0;
- Perfis = 0;
- Acessórios = 0;
- Outros = 0;
- Vidros = 0;
- Produção = 0;
- Instalação = 0.

Teste Projeto conferido sem `obra_id`:
- Medição = 1;
- Perfis = 1;
- Acessórios = 1;
- Outros = 1;
- Vidros = 0.

Teste completo anterior validou Medição aprovada → Vidros + MEE.
Todos os testes temporários foram revertidos/abortados de forma controlada; 0 registros de teste restantes.

## Migrations finais desta correção

- `20260826221809_fluxo_vendido_confirmacao_atomica_v1.sql`;
- `20260826222110_conferir_projeto_sem_obra_v1.sql`;
- `20260826222310_financeiro_contas_receber_cliente360_leitura_v1.sql`.

O histórico local foi alinhado às versões reais já registradas no Supabase; não reaplicar essas migrations só para mudar versão.

## Validação manual no Preview antes do merge

1. Abrir Cliente 360 → Andamento.
2. Confirmar que um orçamento sem venda real mostra `Confirmar venda e gerar Financeiro` e não libera downstream.
3. Confirmar uma venda controlada e conferir Financeiro + Conferir Projeto.
4. Conferir o valor real em Financeiro.
5. Antes de Projeto conferido, conferir materiais bloqueados.
6. Mover Projeto para `Projeto conferido` e conferir Medição + Perfis + Acessórios + Outros, sem Vidros.
7. Aprovar uma Medição Final controlada e conferir Vidros + MEE.
8. Abrir os setores de materiais e testar a seta Voltar.
9. Reprocessar eventos e confirmar que não há duplicidade.
10. Somente após aprovação do usuário considerar merge.

## Próxima definição funcional com o usuário

Depois desta validação, detalhar:
- gate de Produção;
- produção parcial por item/tipologia;
- gate e agendamento de Instalação;
- Compras geral versus Kanbans específicos;
- reabertura após revisão de venda/projeto;
- custo `Previsto → Otimizado → Comprado → Realizado` por cliente/obra/item.

## Regras invioláveis

- GitHub é fonte da verdade.
- Branch → PR → build/preview → merge manual; nunca commit direto em `main`.
- Cliente 360 consolida registros reais; não duplicar status.
- Financeiro é único, filtrado/vinculado por cliente e obra.
- Venda fechada preserva snapshot; alteração posterior exige justificativa/histórico.
- Venda/Orçamento Balcão rápido não entra no Kanban de obras.
- Vidro nunca é liberado antes da Medição Final aprovada.
- MEE pós-medição permanece enquanto depender de `medicao_itens`.
- W.Vetro é referência; conhecimento Atlas validado tem prioridade.
