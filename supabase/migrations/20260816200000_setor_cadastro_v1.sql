-- Adiciona "Cadastro" (linhas, cores, materiais) como setor navegavel.
-- O menu foi reestruturado (lib/guias.ts) e essa rota ficou sem entrada
-- em nenhum lugar visivel: nao aparecia no menu lateral nem na busca rapida
-- (SidebarQuickSearch ja tinha um alias pronto para /cadastro, mas sem
-- nenhum item base ele nunca aparecia nos resultados).

insert into public.setores (id, nome, grupo, ordem, ativo, rota, descricao)
values ('cadastro', 'Cadastro (Linhas, Cores, Materiais)', 'Sistema', 2, true, '/cadastro', 'Cadastro de linhas de produto, cores e materiais (preco do Kg do aluminio).')
on conflict (id) do update set rota = excluded.rota, ativo = excluded.ativo;
