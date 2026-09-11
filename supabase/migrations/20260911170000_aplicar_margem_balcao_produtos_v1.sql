create or replace function public.aplicar_margem_balcao_produtos(
  p_margem numeric,
  p_categoria text default null,
  p_linha_id uuid default null,
  p_status text default 'ativos'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_atualizados integer := 0;
begin
  if p_margem is null or p_margem < 0 or p_margem >= 100 then
    raise exception 'Margem deve estar entre 0 e menos de 100';
  end if;

  update public.produtos
     set margem_percentual = p_margem,
         preco = case
           when coalesce(custo, custo_wvetro_ultimo, custo_wvetro_max, custo_wvetro_min) is not null
            and coalesce(custo, custo_wvetro_ultimo, custo_wvetro_max, custo_wvetro_min) > 0
           then round(coalesce(custo, custo_wvetro_ultimo, custo_wvetro_max, custo_wvetro_min) / (1 - p_margem / 100.0), 2)
           else preco
         end,
         updated_at = now()
   where (p_categoria is null or categoria = p_categoria)
     and (p_linha_id is null or linha_id = p_linha_id)
     and (
       p_status = 'todos'
       or (p_status = 'ativos' and ativo = true)
       or (p_status = 'inativos' and ativo = false)
     );

  get diagnostics v_atualizados = row_count;
  return v_atualizados;
end;
$$;

grant execute on function public.aplicar_margem_balcao_produtos(numeric,text,uuid,text) to authenticated;
