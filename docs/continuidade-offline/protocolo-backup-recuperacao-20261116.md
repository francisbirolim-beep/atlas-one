# Protocolo de proteção e recuperação — Atlas One

**Inspeção:** 2026-11-16  
**Responsabilidade técnica:** revisão de infraestrutura/backup, banco de dados, segurança e QA. **Revisão independente de terceiro ainda não realizada**.  
**Estágio:** análise e preparação documental em branch isolada. Nenhum backup novo nem teste de restauração executados.

## Política de preservação e autorização

- Jamais executar um teste de restauração no banco de produção ou nas tabelas existentes. Usar banco isolado, origem exportada em modo leitura e credenciais segregadas.
- Não interromper SQL Server, Windows, o Atlas online, dispositivos, integrações ou trabalhos da equipe.
- Não reconfigurar energia, rede, DNS, serviços, firewall, deploys, `main`, RLS ou migrations nesta etapa.
- Não usar `/api/restaurar-backup` como mecanismo de recuperação geral: o código atual apaga tabelas da lista antes de inserir snapshots, sem transação abrangente e sem cobertura do esquema completo.
- Não considerar sincronização nuvem/local um backup. Não tratar um backup como aprovado sem restauração testada.
- Nunca exportar secrets, dados de clientes ou conteúdo dos backups para GitHub, logs ou relatórios de execução.

## Evidências apuradas, sem leituras de conteúdo comercial

| Dimensão | Resultado verificável |
| --- | --- |
| Banco Supabase | Projeto `atlas-one` ativo; 284 tabelas `public` identificadas |
| Tamanho lógico/ocupação da base | `pg_database_size` aproximado de 379 MB (não equivale ao tamanho do dump) |
| Backup da aplicação | `lib/backup.ts` lista 11 tabelas; outras 273 tabelas `public` não estão nessa lista |
| Histórico da tabela `backups` | 37 registros; 34 automáticos; último `automatico` em 2026-09-05 06:09 UTC |
| Último registro de qualquer tipo | 2026-10-16, classificado como recuperação de validações W.Vetro, **não automático diário** |
| Anexos Supabase Storage | 14 buckets, 4.040 objetos, soma aproximada de metadados de tamanho 2.149.948.712 bytes (~2,00 GiB) |
| SER​VIDOR | Windows 11 Pro, ~16 GB RAM, rede Ethernet gigabit e serviço SQL Server existente |
| Destino `K:` | `\\SERVIDOR\Faktory_Sistema`: compartilhamento do próprio host, não é backup offsite |
| Rotinas agendadas Windows | Nenhuma rotina Atlas específica identificada pela filtragem dos nomes de tarefas; isso não prova que inexista outro agente de backup |
| Logs Vercel | Busca de `/api/backup` na janela de 24h não retornou registros; ausência de log não comprova ausência de chamadas |
| Backup gerenciado Supabase | **Não confirmado**: o conector disponível não fornece listagem de snapshots administrados pela plataforma nem o plano contratual |
| Restauração completa | **Não executada** |

A documentação atual do Supabase confirma que backup do banco **não inclui o conteúdo binário** dos objetos armazenados pela Storage API; a base contém somente seus metadados. Consultar: https://supabase.com/docs/guides/platform/backups

## Riscos prioritários

1. **Cobertura muito restrita:** o backup interno não representa todo o ERP. Não usar como fundamento de continuidade ou restauração completa.
2. **Restauração destrutiva parcial:** `restaurarSnapshot` faz deleção e reinserção em várias chamadas, sem uma transação única que permita rollback de toda a operação. Em falhas, o sistema pode permanecer inconsistente. Rotina não testada e **não acionada**.
3. **Recência não comprovada:** o cron está declarado no `vercel.json`, mas não há evidência de que tenha continuado a produzir backups diários no banco da aplicação após setembro; verificar cron e seus logs sem modificar o agendamento.
4. **Storage separado:** replicar ou restaurar linhas da tabela `storage.objects` não recupera os bytes de imagens, PDFs, fotos, recibos e desenhos.
5. **Destino inadequado:** copiar para outro compartilhamento do mesmo servidor não protege contra perda da máquina, ransomware local ou falha de disco.
6. **Coexistência:** o SERVIDOR tem outros serviços. Monitorar RAM, CPU e I/O; não instalar Postgres/containers ou alterar suspensão sem estratégia e janela autorizada.

## Responsabilidades de revisão antes de execução

- **Engenharia PostgreSQL/Supabase:** confirmar mecanismo de backups gerenciados e retenção, privilégios de exportação, snapshot consistente, extensões, funções, migrations, roles, jobs e recuperação.
- **Storage/infraestrutura:** enumerar todos os buckets e tamanho/versões, escolher destino independente, criptografia e retenção, validar hashes e download/reupload isolado.
- **Segurança:** separar conta de backup do app, conceder menor privilégio, restringir rede, tratar dados pessoais e chave de criptografia.
- **QA/continuidade:** simular dados de teste e restauração isolada, reconciliar contagens, identidades, permissões, anexos, operações e filas offline.
- **Revisão externa:** exigir outro revisor qualificado antes de procedimentos destrutivos ou entrada em operação. Esta lista é divisão de responsabilidades; **não significa que esses especialistas já executaram revisão independente**.

## Procedimento proposto — sem execução nesta fase

### Etapa 1: inventário somente leitura

1. Verificar no painel Supabase `Database > Backups` se existem snapshots administrados, data da última execução, plano, retenção e elegibilidade de PITR.
2. Conferir itens do esquema além de tabelas: funções, views, triggers, cron, roles, permissões RLS, políticas de Storage e extensão de negócio.
3. Conferir buckets existentes e regras de acesso com **metadados somente**, sem abrir arquivos de clientes.
4. Mapear conexões e dependências de W.Vetro/Neon e demais integrações, sem copiar segredos de produção.
5. Registrar versão do código `main`, versão de migrations e deployment efetivamente publicado.
6. Registrar ocupação de memória e disco antes de testar em equipamento distinto ou sandbox.

### Etapa 2: cópia completa protegida

**Pré-condições:** destino externo independente com controle de acesso e criptografia definidos; conta de backup; procedimento documentado de rotação/retorno; espaço e retenção suficientes. Nenhum serviço contratado ou comprado automaticamente.

1. Gerar exportação consistente do PostgreSQL por mecanismo suportado pelo Supabase, incluindo schema, dados e objetos necessários à restauração, **sem operar em tabelas já existentes**. Verificar escopo de `auth`, `storage`, schemas de negócio, roles, extensões e migrações; custom role passwords requerem reconfiguração segura conforme documentação oficial.
2. Inventariar e copiar separadamente bytes de **todos** os buckets Storage, com caminho normalizado, hash de conteúdo, tamanho e controle de versões.
3. Capturar metadados de deploy, código e configurações necessárias sem persistir valores de secrets em repositório. Garantir que credenciais possam ser reemitidas na recuperação.
4. Proteger o conjunto com criptografia apropriada e cópia independente/offsite, imutabilidade/retensão e permissões mínimas.
5. Validar hash, tamanho, contagem, referência de versão e existência da cópia externa; registrar resultados sem PII.

### Etapa 3: ensaio de restauração — somente em sandbox

1. Criar ambiente de homologação sem conexão com serviços produtivos, com emails, WhatsApp, pagamentos, webhooks e jobs externos desligados.
2. Restaurar em Postgres isolado (nunca no projeto de produção).
3. Recuperar Storage para um bucket/instância de teste isolados e verificar integridade de amostra representativa e total de objetos, sem expor conteúdos comerciais.
4. Comparar contagens e checksums por módulo; testar permissões, login, contas a pagar/receber, contratos, clientes, obras, orçamentos, Kanbans, medição, fotos e catálogos de perfis/acessórios com suas imagens reais.
5. Simular perda de conexão ou desligamento no meio de uma transação, retomada de filas, dados novos e anexos pendentes; certificar que não há duplicação nem descarte.
6. Registrar tempos RPO/RTO mensurados; pedir metas aceitáveis ao responsável antes de declarar recuperação suficiente.

### Etapa 4: operacionalização posterior

- Definir frequência de backups e retenção a partir do RPO aprovado. Verificar diariamente **sucesso real**, volume e data do último backup; alertar sobre falha e ausência.
- Executar restauração isolada periódica; monitorar integridade dos anexos e divergências.
- Tratar atualização de esquema como mudança compatível com versões locais/offline antigas e outboxes pendentes.
- Implantar localmente apenas após backup verificado, requisitos de desempenho e teste de regressão. Atualizações preparadas em ambiente isolado e publicadas somente após autorização/revisão.

## Critérios de aceite desta fase

- [x] Mecanismo atual identificado por leitura de código
- [x] Metadados de cobertura banco/Storage examinados
- [x] Destino `K:` identificado como compartilhamento do próprio servidor
- [x] Risco de restauração destrutiva documentado
- [ ] Backup completo, cifrado e independente criado
- [ ] Disponibilidade e retenção de backups Supabase verificadas
- [ ] Storage exportado e checksums verificados
- [ ] Restauração de base e anexos testada em ambiente isolado
- [ ] Ensaios de falha/recuperação e RPO/RTO registrados
- [ ] Revisão independente especializada e aprovação de entrada em operação realizadas

**Status final:** documento técnico de preparação, não prova de backup nem implementação offline. Nenhum programa, serviço, dado ou configuração de produção foi alterado.
