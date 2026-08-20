# Busca global — Administração — 2026-08-20

Correção pequena na busca global do Atlas após validação visual do usuário.

Problema: `SidebarQuickSearch` indexava `GUIAS` e setores, mas não os atalhos administrativos renderizados separadamente na Sidebar. Assim pesquisar `administração` não retornava Configurações, Usuários e Senhas, Padrão do Orçamento, Fórmulas de Corte, Setores e Cadastro.

Correção: para usuário Master, a busca agora indexa explicitamente esses atalhos administrativos. `Fórmulas de Corte` também responde a termos como fórmula, corte, engenharia, tipologia, cálculo, perfil e administração.

Sem migration e sem alteração de banco.
