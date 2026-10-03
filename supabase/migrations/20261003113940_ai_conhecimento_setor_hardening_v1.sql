-- Conhecimento supervisionado e trilha sao backend-only.
-- Mesmo com RLS sem policies (deny by default), revogamos grants diretos explicitamente.

revoke all on table public.ai_conhecimento_setor from anon, authenticated;
revoke all on table public.ai_conhecimento_setor_eventos from anon, authenticated;
