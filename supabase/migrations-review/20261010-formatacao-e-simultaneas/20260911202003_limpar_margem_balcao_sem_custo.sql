update public.produtos
set margem_percentual = null,
    preco = case when coalesce(preco,0)=0 then 0 else preco end,
    updated_at = now()
where categoria='acessorio'
  and ativo=true
  and coalesce(custo,custo_wvetro_ultimo,custo_wvetro_max,custo_wvetro_min,0)<=0
  and margem_percentual=35;
