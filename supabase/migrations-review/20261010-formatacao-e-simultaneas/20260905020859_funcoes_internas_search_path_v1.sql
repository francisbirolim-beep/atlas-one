alter function public.update_updated_at() set search_path = public;
alter function public.fn_engenharia_conferencia_touch() set search_path = public;
alter function public.fn_engenharia_receita_touch() set search_path = public;
alter function public.fn_formula_tipologia_snapshot_v1(public.engenharia_tipologia_formulas_corte) set search_path = public;
alter function public.auto_validar_produto_catalogo_fornecedor() set search_path = public;
alter function public.auto_vincular_item_catalogo_validado() set search_path = public;

revoke execute on function public.update_updated_at() from public, anon, authenticated;
revoke execute on function public.fn_engenharia_conferencia_touch() from public, anon, authenticated;
revoke execute on function public.fn_engenharia_receita_touch() from public, anon, authenticated;
revoke execute on function public.auto_validar_produto_catalogo_fornecedor() from public, anon, authenticated;
revoke execute on function public.auto_vincular_item_catalogo_validado() from public, anon, authenticated;
