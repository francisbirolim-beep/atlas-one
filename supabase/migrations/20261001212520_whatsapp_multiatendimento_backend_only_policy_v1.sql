
create policy atendimento_etiquetas_backend_only
on public.atendimento_etiquetas for select to authenticated
using (false);

create policy atendimento_conversa_etiquetas_backend_only
on public.atendimento_conversa_etiquetas for select to authenticated
using (false);

create policy atendimento_notas_backend_only
on public.atendimento_notas for select to authenticated
using (false);

create policy atendimento_mensagens_rapidas_backend_only
on public.atendimento_mensagens_rapidas for select to authenticated
using (false);
