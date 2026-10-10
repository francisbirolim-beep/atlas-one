# Reconciliação de SQLs históricos realmente aplicados — 10/10/2026

Operação exclusivamente no repositório: **nenhum SQL foi executado no banco de produção**.

- Foram recuperados, individualmente, **87 SQLs** da tabela de histórico do Supabase, de versões já aplicadas.
- Cada conteúdo foi validado contra o hash MD5 gravado na consulta ao Supabase e contra o MD5 histórico anteriormente auditado.
- Os 87 arquivos locais anteriores foram **preservados integralmente**, sem alterar um byte, em supabase/migrations-review/20261010-content-differences/.
- Os 87 arquivos ativos nas mesmas versões foram substituídos pelo **SQL realmente executado**. Isso melhora a reprodutibilidade do histórico.
- Somando a migração posterior de compatibilidade, a pasta ativa contém **316 versões únicas**.
- Outros **126 arquivos** continuam com formatação diferente (fingerprint igual após remoção de espaços) e não foram alterados nesta etapa.
- As outras 44 versões locais que não haviam sido aplicadas continuam preservadas em supabase/migrations-review/20261010/.

## Garantias e limites

O manifesto JSON adjacente lista o MD5 do SQL aplicado, SHA-256 de cada original arquivado e blob SHA original, facilitando auditoria ou restauração. A pasta de versões arquivadas **não deve ser incluída nos comandos de execução de migração**.

Ter a mesma versão e conteúdo no repositório não implica que aplicar o conjunto completo em um banco vazio reproduza a configuração atual sem efeitos colaterais. As migrações históricas podem depender de ordem, dados e extensões; qualquer reconstrução precisa ser validada em ambiente descartável.

O workflow Supabase Database Control deve executar somente **dry-run** neste PR e os testes transacionais com rollback; não executar db push nem migration repair em produção.

Rollback de código: reverter o commit deste PR para restaurar os arquivos locais anteriores. O banco não precisa de rollback.

## Migração simultânea identificada durante o CI

Durante a validação do PR, outra etapa aplicou a versão 20261010203407 (venda_cotacao_lotes_categoria_v1) ao banco. O conteúdo original foi recuperado diretamente do Supabase e seu MD5 conferido, sem aplicar SQL adicional. Esse arquivo foi adicionado ao conjunto ativo para manter a simulação de migrações alinhada.
