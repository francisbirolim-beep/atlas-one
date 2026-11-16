# Atlas One — resultado da validação de transporte criptografado (16/11/2026)

**Escopo:** teste técnico executado com dados fictícios. Nenhum backup completo de produção foi criado.

## Evidências

- O OneDrive do SERVIDOR continha a pasta `BACKUP ATLAS`; o Mac continha a pasta homônima.
- Arquivo fictício de sincronização enviado pelo SERVIDOR foi lido no Mac sem diferença de conteúdo.
- Ferramenta isolada instalada em `C:\AtlasOneBackup\tools\atlas-package.mjs`, fora da aplicação e sem configuração de tarefa agendada.
- Amostra inventada de 80 bytes criptografada em AES-256-GCM, produzindo 118 bytes.
- Pacote salvo no armazenamento local isolado e copiado para a pasta sincronizada do OneDrive.
- A mesma cópia cifrada foi recebida e lida no Mac: hash SHA-256 idêntico `888b738eb2b86f7c56d57e6c7253d4f1401ad1b1345fd33a57b0814aa64afa8f`.
- Verificação da tag de autenticação AES-GCM realizada. Recuperação isolada reproduziu exatamente a amostra original.
- Adulteração de um byte foi rejeitada na autenticação.
- Tentativa de sobrescrever arquivos existentes foi rejeitada.
- Nenhum segredo de produção ou dado de clientes foi usado.

## Limites / pendências

- **Não há backup novo do banco PostgreSQL de produção ou dos bytes do Supabase Storage**. A ferramenta cifra e transporta um arquivo fornecido, mas ainda não exporta dados do Supabase.
- Ausente na máquina o `pg_dump`; não há string de conexão com senha para exportação consistente e segura disponibilizada ao processo.
- Antes de rodar em dados reais: definir conta/role de exportação, formato de dump consistente, leitura de todos os buckets do Storage, cadência, verificação de quotas, limites de carga, retenção anti-ransomware e guarda independente de chave de recuperação.
- O teste em dois computadores confirma sincronismo naquele momento, **não** comprova que a nuvem permite restaurar versões excluídas, nem que a conta seja empresarial; o usuário autorizou expressamente esse destino.
- Falta teste de restauração de **todo o Atlas One** em ambiente isolado e revisão independente de especialista.
- **Nenhum job de backup real foi agendado. Nenhum deploy, migração ou alteração em produção.**

## Próximas ações técnicas

1. Disponibilizar método seguro de exportação completo do PostgreSQL; jamais alterar senha de produção para obtê-lo.
2. Exportar bytes de todos os buckets do Storage e dados de autorização e permissões necessários.
3. Proteger e testar guarda offline da chave e definir retenção/versionamento isolado.
4. Fazer primeiro backup real sob limitação de carga, verificar SHA-256 nos destinos e confirmar remotamente o OneDrive.
5. Restaurar no banco e Storage de homologação com serviços externos desabilitados; documentar RPO/RTO.
6. Só então considerar backup automático em segundo plano, após revisão de segurança e validação operacional.
