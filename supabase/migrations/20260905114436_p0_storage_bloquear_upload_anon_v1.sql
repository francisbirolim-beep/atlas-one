drop policy if exists fotos_upload_publico on storage.objects;
create policy fotos_upload_autenticado
on storage.objects
for insert
to authenticated
with check (bucket_id = 'fotos');

revoke execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from authenticated;
grant execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;
