grant usage on schema private to authenticated;
revoke create on schema private from public;
revoke all on function private.current_empresa_id() from public;
grant execute on function private.current_empresa_id() to authenticated;
