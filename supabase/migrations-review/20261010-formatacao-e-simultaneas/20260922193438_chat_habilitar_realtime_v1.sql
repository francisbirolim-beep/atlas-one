do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_mensagens') then alter publication supabase_realtime add table public.chat_mensagens; end if;
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_conversas') then alter publication supabase_realtime add table public.chat_conversas; end if;
end $$;
