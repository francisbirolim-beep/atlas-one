# Histórico de migrações do Supabase – auditoria 10/10/2026

Esta divergência já existia antes das correções operacionais e NÃO deve ser resolvida excluindo versões remotas, marcando migrações falsas como executadas ou executando db push --include-all no banco de produção sem revisão.

## Evidência observada

A tabela supabase_migrations.schema_migrations possui 314 versões aplicadas; a pasta supabase/migrations contém 301 arquivos após alinhar os dois últimos nomes. O confronto por versão apontou 56 versões existentes somente no remoto e 43 arquivos somente no repositório. As linhas remotas guardam os SQLs originais em statements; todas as 314 possuem conteúdo. Há pelo menos 9 casos em que arquivo local e versão remota têm hash MD5 idêntico, mas timestamps diferentes. Outros arquivos possuem nome parecido, mas SQL diferente, e NÃO devem ser considerados equivalentes sem uma revisão de conteúdo.

A falha do workflow Supabase Database Control é real: o supabase db push --dry-run --include-all recusa as 56 versões remotas não presentes no repositório. Não é falha do SQL novo de encerramento; a função e os triggers foram aplicados e verificados diretamente no remoto.

## Procedimento seguro para concluir a reconciliação

1. Exportar version, name, statements do histórico remoto para um backup com acesso restrito, sem registrar credenciais em logs.
2. Conferir e repor no Git os arquivos originais correspondentes aos SQLs realmente executados, usando a versão remota exata. Isso pode exigir recuperar migrações de branches históricos ou da coluna statements.
3. Para os 43 arquivos só locais, verificar individualmente se são migrações genuinamente pendentes, cópias com timestamp diferente ou versões alternativas. Somente versões integralmente equivalentes podem ser renomeadas para o timestamp aplicado. Arquivos distintos não podem ser marcados retroativamente como executados.
4. Fazer um dry-run em ambiente isolado antes de permitir qualquer db push na produção. Não executar supabase migration repair de modo automático.
5. Executar novamente o CI e registrar diferenças residuais, se houver.

As funções instaladas por este trabalho ficam sujeitas ao mesmo alinhamento de histórico. O arquivo de encerramento foi alinhado para 20261010192717; o vínculo atômico foi alinhado para 20261010195036. Nenhum vínculo de cliente, obra ou pagamento foi alterado ao instalar as funções.
