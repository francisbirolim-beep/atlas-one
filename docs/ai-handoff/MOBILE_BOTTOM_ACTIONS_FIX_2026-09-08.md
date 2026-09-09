# Correção mobile — ações finais atrás da navegação

Em 2026-09-08 foi identificado no iPhone que a barra de navegação inferior fixa podia encobrir o final de fluxos longos, incluindo o botão `Enviar pedido`, e que o modal de ações do Cliente 360 podia ficar sem rolagem suficiente.

A correção adiciona espaço inferior compatível com a barra fixa e `safe-area-inset-bottom`, e torna overlays móveis `z-30` roláveis e acima da navegação.

O erro de `revisao_grupo_id` observado no mesmo teste não é causado pelo layout. A implementação atual de `lib/orcamentos.ts` já grava `revisao_grupo_id: novoId` ao criar um orçamento novo; portanto o teste deve ser repetido após a publicação da `main` atualizada antes de qualquer nova alteração de banco.
