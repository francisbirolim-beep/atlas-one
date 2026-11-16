# Atlas One — proteção de dados e recuperação (auditoria de 16/11/2026)

**Situação:** inventário e plano somente de leitura; NÃO existe backup integral testado nesta entrega.  
**Regra operacional:** preservar tudo que funciona; nenhuma mudança na produção, nenhum DELETE/TRUNCATE, nenhuma migração, nenhum restore no banco real e nenhum serviço novo no SERVIDOR. Todas as provas de recuperação devem ocorrer em destino isolado.  
**Responsabilidade técnica necessária:** engenharia PostgreSQL/Supabase + infraestrutura/backup + segurança; exigir revisão cruzada e evidências antes da liberação.

## Evidências observadas (16/11/2026; consultas de metadados)

- Supabase `atlas-one` (`urtqbvjpwnrfaayolymt`), ACTIVE_HEALTHY, PostgreSQL 17.
- `public`: **284 tabelas**. `storage`: **10 tabelas**. O módulo de backup interno inclui apenas **11 nomes de tabelas** (`lib/backup.ts`); não contempla todos os domínios.
- `public.backups`: **37 registros**; último registro em **16/10/2026 17:38** (São Paulo), com somente **uma tabela** e tipo especial `recuperacao_validacoes_wvetro_384`.
- Último backup interno identificado como `automatico`: **05/09/2026 03:09** (São Paulo), com 11 tabelas. Não há comprovação de execução posterior do cron interno. O agendamento consta em `vercel.json` (`/api/backup`, `0 6 * * *`), mas agendamento no código NÃO confirma execução.
- `storage.buckets`: **14 buckets**; `storage.objects`: **4.040 objetos** no catálogo. Tamanho de metadados dos objetos com campo `size`: aproximadamente **2,15 GB**; não é prova de integridade de conteúdo. Distribuição principal: `fotos` (2.663 objetos) e `whatsapp-midia` (1.341 objetos).
- `lib/backupServer.ts` salva o JSON das 11 tabelas em `public.backups` no mesmo banco e `restaurarSnapshot` faz DELETE de todas as linhas dessas tabelas seguido de INSERT, em múltiplas chamadas. Esta rota NÃO é uma restauração transacional, completa ou segura para uso operacional.
- `app/api/restaurar-backup/route.ts` invoca aquela rotina depois de criar um snapshot restrito. **Não usar esta rota para validar recuperação**.
- SERVIDOR Windows: Node disponível, aproximadamente 16 GB RAM total, 4,5 GB RAM livre no instante consultado, aproximadamente 816 GB decimais livres nos drives reportados. `psql`, `pg_dump`, `pg_restore`, `docker`, `git` não foram localizados no PATH; isto não prova ausência em outras pastas. Nenhuma instalação ou configuração de produção foi alterada.
- O branch Supabase de homologação já existente, `security-homologacao-20261024`, indica `MIGRATIONS_FAILED`: NÃO assumir que serve para ensaio de recuperação.
- **Limite de verificação:** backups gerenciados pela plataforma, retenção contratada e disponibilidade do PITR ainda não foram confirmados no painel/API de backups. Não inferir que estão ativos ou inativos a partir do catálogo `public.backups`.

## Ações técnicas priorizadas (ordem mandatória)

1. **Inventário sem alterações:** listar bancos e esquemas efetivamente utilizados (incluindo `auth`, `public`, `storage`, funções, RLS, triggers, extensões, jobs, W.Vetro/Neon quando aplicável), além de objetos em cada bucket. Inventariar aplicações, configurações e dependências externas; não exportar segredos ou dados pessoais em logs.
2. **Verificar backups gerenciados do Supabase:** painel *Database > Backups* e, se pertinente, API de gerenciamento autenticada. Registrar último backup concluído, retenção e se PITR está disponível. **Não disparar restauração do projeto em produção.**
3. **Criar cópia independente com ferramental PostgreSQL** em máquina/contêiner de backup isolado e autorizado, com credencial de privilégio mínimo, TLS, sem exibir credenciais: exportar esquema, dados, roles necessárias e objetos fora do banco. Seguir documentação/versão atual da CLI e executar operação com limite de recursos para não impactar o ERP. Não copiar backup para GitHub.
4. **Exportar os objetos de Storage separadamente** por API autorizada, preservando identificadores, caminhos, metadados, acesso e checksums; conferir totais e erros/retries. Snapshot físico/lógico do banco NÃO recupera automaticamente os bytes dos objetos armazenados pelo Storage.
5. **Proteger cópia** com criptografia, permissões restritas, retenção e destino fora do banco principal e fora do SERVIDOR único. Não considerar sincronização ou réplica como backup.
6. **Restaurar integralmente em laboratório isolado** usando banco e arquivos de teste: esquema, dados, regras RLS, autenticação (sem senhas produtivas expostas), integridade referencial, permissões, fotos/documentos, verificações de amostras/contagens, receitas e histórico. Não permitir conexão do laboratório a serviços produtivos, webhooks ou processamento financeiro.
7. **Registrar evidências**: ID/horário da cópia, tamanho, hash, erros, cobertura de tabelas e arquivos, duração, resultado do ensaio, responsáveis por revisão. Estabelecer RPO/RTO aprovados pela operação e monitorar falhas.
8. **Somente depois** avaliar correção não destrutiva do fluxo interno de backup/restauração e iniciar desenvolvimento offline em branch e banco isolados.

## Critérios obrigatórios de aceitação

- [ ] Backups gerenciados e política de retenção confirmados com evidência.
- [ ] Banco completo e objetos de todos os buckets relevantes exportados e verificados.
- [ ] Cópia externa, protegida, criptografada e recuperável.
- [ ] Restauração executada **somente em ambiente isolado**, com validação de dados, anexos, permissões e integrações desativadas.
- [ ] Recuperação validada por revisão técnica independente, com tempo medido e plano de retorno.
- [ ] Nenhuma mudança em `main`, Vercel produção, Supabase produção ou SERVIDOR existente durante preparação.

## Impedimentos atuais

Não foi disponibilizado por ferramenta um inventário dos backups gerenciados da plataforma, nem um mecanismo seguro de exportação integral de banco e Storage para destino independente. No SERVIDOR, utilitários PostgreSQL não apareceram no PATH. Portanto, **não foi produzido nem testado um novo backup integral nesta etapa**. Prosseguir apenas com método seguro, destino isolado e recursos dimensionados; contratação/custo exige aprovação prévia.

## Referências de código verificadas

- `lib/backup.ts`
- `lib/backupServer.ts`
- `app/api/backup/route.ts`
- `app/api/restaurar-backup/route.ts`
- `vercel.json`
- `docs/continuidade-offline/diagnostico-plano-20261116.md`

**Fontes técnicas:** [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups) e [Supabase Changelog](https://supabase.com/changelog.md).