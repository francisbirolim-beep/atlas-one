# Próximo teste — DANFE PDF

1. Publicar parser DANFE v2 em produção após preview Vercel READY.
2. Reenviar o mesmo PDF/DANFE real usado no teste da NF 3128.
3. Conferir cabeçalho, CNPJ e quantidade de itens extraídos.
4. Se itens continuarem em zero, ler `[Compras][DANFE][diagnostico]` nos logs da Vercel e adaptar o parser ao layout real.
5. Não confirmar NF nem atualizar custo enquanto a leitura dos itens não estiver validada.
