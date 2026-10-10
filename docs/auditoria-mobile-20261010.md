# Auditoria de paridade mobile — Atlas One

**Data:** 10/10/2026  
**Base:** revisão integrada à versão principal de 10/10/2026; alterações em branch isolada.
**Regra:** preservar funções, permissões, integrações e regras de negócio existentes.

## Abrangência do código

Foram percorridas recursivamente **140 páginas** do aplicativo e **86 componentes TSX**. A análise procurou menus desktop/mobile, elementos ocultos por breakpoint, controles acionados apenas por hover, colunas com largura fixa, tabelas, modais, campos, áreas de rolagem, safe areas e layouts de altura fixa.

A aplicação já possui múltiplos ajustes responsivos existentes (Kanban, medições, produção e dashboards). Esses ajustes foram preservados. A equivalência visual e funcional de todas as páginas **não pode ser declarada apenas por inspeção do código**.

## Problemas concretos tratados nesta branch

1. **Navegação no WhatsApp:** acesso ao menu completo do Atlas pelo cabeçalho mobile, sem sobrepor a caixa de mensagens com a barra inferior.
2. **Conversas internas:** listadas também em celulares/tablets. A coluna existente em desktops XL continua intacta; pesquisa mobile e desktop são independentes.
3. **Ações por toque:** acompanhamento, transferência, etiquetas, resposta e reações deixam de depender exclusivamente de hover.
4. **Atalho de notificações:** botão compacto disponível no celular quando a API de notificações estiver habilitada para o dispositivo.
5. **Paridade de menus:** acesso rápido a novo orçamento e WhatsApp na navegação mobile; listas de setores e administração continuam compartilhadas com o desktop, preservando permissão Master.
6. **Medidas e formulários:** proteção de largura de filhos de grids, campos, mídias e tabelas roláveis em telas até 767px.
7. **Login/redefinição:** campos de 16px em celular evitam ampliação involuntária de foco no iPhone; espaçamento reduzido para telas estreitas.
8. **Plano de corte A4:** prévia rolável na horizontal no celular; CSS de impressão/PDF não foi alterado.
9. **Safe area do WhatsApp:** remove espaço de barra inferior em tela cheia, mantendo o compositor.
10. **Orçamento sob medida:** barra `Continuar` fica acima da navegação inferior móvel, sem cobrir botões.
11. **Resumo da medição final:** quantidade, responsável e data da última atualização também aparecem nas linhas da lista no celular.
12. **Cotações de fornecedores:** tabela A4 rolável no celular e assinaturas reorganizadas sem alterar a impressão.
13. **Consultoria:** visualização do caderno com altura adaptada a telas pequenas e avisos que quebram linha.


## Testes e limites

- Executar `node scripts/test-mobile-paridade.cjs` e `npm run typecheck`.
- Conferir prévia na Vercel e o commit exato publicado antes de qualquer promoção.
- Conferir com usuário autorizado em iPhone/Android os fluxos: Cliente 360, orçamento, medição final, Engenharia, Produção/Kanbans, Vendas, Compras/Estoque, Financeiro, Relatórios, Administração, Supervisão da IA e WhatsApp interno/externo.
- Os testes automatizados **não enviam mensagens, não efetuam pedidos e não alteram dados**. Telas autenticadas exigem validação final pelo usuário.

## Critérios de aceite no celular

1. Mesmo perfil de acesso e permissões do desktop.
2. Nenhum botão de ação importante inacessível apenas por hover.
3. Não cortar formulários, fotos, tabelas ou botões de conclusão.
4. Menus, modais, Kanbans e relatórios com rolagem adequada e área de toque utilizável.
5. Desktop e impressão preservados, sem mudanças nos cálculos do ERP.
