# Correção Kanban — iniciar orçamento e preservar foto

## Objetivo
Corrigir o fluxo da primeira coluna do painel de orçamentos.

## Regras validadas
- Todo card na primeira coluna deve exigir **Iniciar orçamento**, inclusive para o usuário que criou o pedido.
- Se o orçamento já tiver sido iniciado e o usuário sair, o retorno deve mostrar **Retornar orçamento**.
- Fotos já vinculadas ao item devem continuar disponíveis ao abrir a edição.
- A correção apenas preserva/exibe fotos; leitura automática de trena fica para uma etapa posterior.

## Implementação
- `app/kanban/page.tsx` passa a usar `components/system/KanbanPageFixed.tsx`.
- O componente remove a exceção da antiga Fase 8 (`podeEditarSemIniciar = false`).
- Ao abrir o card, as fotos existentes são normalizadas a partir de `foto_url`, `foto_urls`, `foto_larguras_url` e `foto_alturas_url`, sem apagar as referências já existentes.
