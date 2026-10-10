# Reconciliação controlada do histórico de migrações - 10/10/2026

Esta operação altera somente os arquivos versionados no Git e NÃO executa SQL no banco.

Os SQLs de 56 versões já aplicadas foram recuperados diretamente da coluna statements da tabela supabase_migrations.schema_migrations, com hash MD5 verificado, e restaurados na pasta de migrations.

44 arquivos locais (43 versões únicas não presentes no histórico remoto) foram movidos para supabase/migrations-review/20261010, preservados para revisão individual, sem aplicação.

Agora supabase/migrations contém 314 arquivos correspondentes a 314 versões remotas, sem timestamps duplicados. Nenhuma operação de SQL DDL, db push ou migration repair foi realizada.

ALERTA: alinhamento de versões não prova identidade integral dos SQLs. Dos 258 arquivos que já tinham versão correspondente, 45 tinham MD5 idêntico, 171 têm o mesmo fingerprint após retirar espaços, e 87 diferem mesmo após normalização. Essas 87 versões exigem revisão de conteúdo antes de declarar o histórico completamente fiel. Arquivo com hashes e comprimentos: docs/supabase-migration-reconciliation-manifest.json.

O objetivo imediato é restabelecer o dry-run seguro, sem executar migrações históricas. Para reproduzir um banco novo é necessário revisar as 87 divergências e as 44 versões locais arquivadas. Reversão: git revert do commit correspondente, sem mudanças no banco.
