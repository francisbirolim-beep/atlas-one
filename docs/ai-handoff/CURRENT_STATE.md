# CURRENT_STATE.md — Atlas One

> Checkpoint anterior preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-CURRENT_STATE.md`.

## EM VALIDAÇÃO — MODO VENDA BALCÃO INTEGRADO AO ATLAS — 2026-08-25

Decisão consolidada: **Venda Balcão é um modo operacional do Atlas One, não um sistema separado**.

Estado desta branch:
- `components/system/BalcaoShell.tsx` identifica explicitamente `Modo Venda Balcão`;
- botão `Voltar ao Atlas` retorna ao ERP completo (`/`);
- no mobile existe acesso direto `Atlas` no cabeçalho do balcão;
- menu do balcão continua focado em Venda, Orçamento, Consulta, Atendimentos, Histórico, Caixa, Contas a Receber e Relatórios;
- adicionada seção `Gestão compartilhada` com links para as telas completas do mesmo Atlas:
  - Clientes `/clientes`;
  - Produtos / Cadastros `/cadastros`;
  - Estoque `/estoque`;
  - Compras / NF `/compras`;
- nenhum cadastro/banco/estoque foi duplicado;
- fiscal/NFC-e/NF-e permanece evolução posterior, dependente de provedor e regras fiscais.

Regra arquitetural: o mesmo produto, cliente, estoque, unidade, compra e financeiro devem servir tanto ao ERP completo quanto ao Modo Venda Balcão.

## Base já integrada na `main`

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão;
- PR #257: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento reservado;
- PR #258: auditoria completa W.Vetro integrada na `main` no commit `bb4bc98`;
- PR #271: cancelamento/devolução transacional da Venda Balcão;
- PR #272: busca combinada + layout compacto do balcão;
- PR #273: busca incremental;
- PR #274: captura nativa de digitação na Consulta de preço.

### Referência W.Vetro disponível

- 1.307 perfis W.Vetro preservados;
- 1.174 acessórios W.Vetro;
- 111 tipologias de referência, 109 mapeadas;
- 119 linhas de referência;
- 1.529 códigos de perfil observados no histórico;
- 1.294 códigos de acessório observados no histórico;
- 14 vidros referência;
- 2.481 produtos consultados na API;
- 1.287 imagens copiadas para o Atlas;
- configuração/fórmula/receita validada Atlas sempre tem prioridade sobre W.Vetro.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- Venda Balcão e Atlas completo compartilham a mesma base e os mesmos cadastros; não duplicar backend.
- W.Vetro é referência/origem; Atlas validado é a versão técnica oficial.
- Nunca sobrescrever automaticamente fórmula, receita, custo, preço, margem ou unidade operacional Atlas com valor histórico W.Vetro.
- Variável inferida sem regra Atlas validada deve permanecer `A definir`.
- Associação externa automática somente por identidade segura/exata; sem fuzzy.
- Imagem W.Vetro nunca substitui automaticamente imagem Atlas existente.
- `produtos.unidade` é unidade operacional; `unidade_origem`/`qtde_embalagem_origem` são proveniência.
- Tipologia = custo técnico. Venda Balcão = preço comercial próprio.
- Hardening legado da Engenharia continua tarefa separada; não habilitar RLS às cegas.
