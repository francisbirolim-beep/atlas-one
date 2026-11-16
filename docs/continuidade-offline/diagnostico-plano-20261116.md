# Atlas One — diagnóstico de continuidade local e operação offline

**Data da inspeção:** 2026-11-16  
**Estado:** diagnóstico somente leitura; nenhuma implantação, migração ou alteração de dados executada.  
**Base da branch:** `ee357a0b9f782fca1a684de29d2911285dabfd16` (main da inspeção).  
**Prioridade:** preservar produção e operações financeiras; validar recuperação antes de qualquer mudança.

## 1. Objetivo e limites

- A empresa deve poder continuar usando **todos os módulos internos**, inclusive orçamentos, financeiro, produção, compras, estoque, medições e Kanbans, quando a internet externa falhar, desde que a rede, energia e servidor locais estejam disponíveis.
- Usuários externos autorizados continuarão operando na nuvem; suas alterações serão reconciliadas quando houver conectividade com a unidade.
- Dispositivos previamente autorizados poderão trabalhar com dados previamente baixados, gerando operações pendentes persistentes.
- A referência consolidada permanece online, mas **dados locais ainda não enviados nunca poderão ser descartados por uma cópia da nuvem**.
- Serviços externos (W.Vetro, mensagens, IA, bancos e outros) terão estado **pendente**, e não "concluído", enquanto não houver confirmação.

## 2. Evidências inspecionadas

- Repositório GitHub `francisbirolim-beep/atlas-one`: `main` em `ee357a0...` durante a inspeção.
- Vercel: projeto `atlas-one`, com implantação `production` marcada `READY` referente ao mesmo commit no momento da consulta. Havia também uma build de prévia não relacionada em andamento; não alterada.
- Supabase: projeto `atlas-one` ativo. O levantamento de esquema revelou centenas de tabelas operacionais; inventário completo e ownership por módulo ainda pendentes.
- `lib/supabase.ts`: cliente Supabase usado diretamente pela aplicação. A documentação `docs/ai-handoff/ARCHITECTURE.md` também descreve dependência de acesso direto do frontend; revisar descompassos entre documentação e código antes de cada implementação.
- `lib/offlineFila.ts`: armazenamento IndexedDB de pendências para orçamento, assistência, medição final e fotos, além de rascunhos. Isto **não é** sincronização transacional de todos os módulos.
- `public/sw.js`: cache de shell/páginas e assets. Cache de interface **não substitui** backend, dados ou regras offline.
- `lib/backup.ts` e `lib/backupServer.ts`: backup interno abrange apenas lista restrita de tabelas e grava snapshots na própria infraestrutura de dados. Não comprova backup integral e independente.
- `vercel.json`: cron de backup declarado, mas a existência de agendamento no código não comprova execução recente, cobertura ou restauração.
- O repositório contém referência a Neon staging para W.Vetro; confirmar no ambiente real a função de cada banco e serviços de integração antes de alterar arquitetura.
- SERVIDOR autorizado: Windows 11 Pro x64; aproximadamente 16 GB de RAM; rede Ethernet gigabit; armazenamento com folga na inspeção; SQL Server existente em execução. Node.js está disponível. Não foram identificados `git`, `docker` ou `psql` no PATH consultado, sem prova de ausência em todas as instalações.
- A interface Ethernet do SERVIDOR usa IP local configurado estaticamente. A configuração de energia permite suspensão automática após um intervalo na alimentação elétrica: antes de servir o Atlas, planejar disponibilidade 24/7 **sem modificar ajustes de outros sistemas neste diagnóstico**.

## 3. Lacunas e riscos críticos

1. **Recuperação não comprovada:** não foi executada restauração integral; cobertura do backup interno é insuficiente para o escopo ERP e exige avaliação de backups gerenciados, retenção, Storage e cópia externa cifrada.
2. **Dependência da nuvem:** chamadas Supabase diretas no frontend e rotas server-side dependentes de serviços externos precisam de camada de acesso local/roteamento controlado; `dev:lan` não é serviço produtivo offline.
3. **Concorrência e duplicação:** local e online podem aceitar alterações simultâneas; sincronização ingênua por timestamp ou substituição de base criaria risco em financeiro, estoque, orçamento e Kanban.
4. **Capacidade do equipamento:** coexistência com SQL Server e demais aplicações exige medir CPU, memória, disco, uso, inicialização e comportamento ao suspender. Não instalar serviços novos sobre cargas existentes sem isolamento e teste.
5. **Identidade e segurança:** definir autenticação offline com expiração, menor privilégio, empresa/tenant e trilha auditável, inclusive revogação pendente de conectividade.
6. **Anexos e catálogos:** fotos de medição, documentos, desenhos e imagens obrigatórias de perfis e acessórios precisam de cache e transferência com checksum; ausência de arquivo nunca deve ser representada por imagem válida ou documento sincronizado.

## 4. Arquitetura candidata para homologação

**Nuvem:** Next.js exposto externamente + PostgreSQL/Storage atuais como referência consolidada, com servidor de sincronização autenticado e trilha de operações.  
**Rede da empresa:** processo local de produção em ambiente isolado, PostgreSQL/armazenamento local gerenciado, identidade e regras de domínio disponíveis sem internet; acesso interno preferencial por endpoint local estável.  
**Dispositivos:** PWA/aplicativo com catálogo de obras/dados permitidos baixado antecipadamente, SQLite/IndexedDB conforme plataforma, fila persistente, fotos e indicador de pendências.

**Padrão de escrita:** transação local de domínio + evento em outbox na mesma operação atômica; identificador global, chave de idempotência, versão por agregado, auditoria e confirmações end-to-end. Toda reconciliação deve ter protocolo de handshake, confirmação de persistência no destino, retransmissão segura, retries e interface de conflitos. Nunca usar "última gravação vence" genericamente.

**Reconciliação por domínio:**
- Financeiro: lançamentos imutáveis/correções compensatórias, conciliação humana de duplicidade e confirmação de baixa real.
- Estoque: movimentos rastreáveis, reservas e disponibilidade global possivelmente provisória durante queda.
- Orçamento e venda: versões/snapshots, conflito explícito de edição; não recalcular silenciosamente pedido fechado.
- Kanban: eventos e efeitos associados idempotentes, sem criação duplicada de ordens ou instalação.
- Numeração: IDs globais internos + numeração fiscal/comercial resolvida por servidor ou faixas autorizadas.
- Anexos: hashes, retomada e verificação de integridade antes de marcar enviado.

**Decisão pendente de prova:** comparar opção de navegação preferencial pela LAN (evita alternância de banco durante transações) com alternância automática; validar DNS, TLS, autenticação, fallback de servidor e UX nos sistemas reais. Não confundir redundância com backup.

## 5. Proteção e testes antes de iniciar implementação

1. Inventariar todos os bancos, tenants, tabelas, objetos de Storage, funções, jobs, credenciais de serviço, versões e dependências; confirmar backups gerenciados e janelas.
2. Gerar backup consistente com ferramenta adequada ao mecanismo do banco, incluir anexos e configurações, criptografar, manter cópia independente do servidor local e da base principal. **Nunca exportar senhas ou dados brutos para GitHub ou logs.**
3. Restaurar em ambiente **isolado**, testar contagens, integridade referencial, anexos, RLS/tenant e filas pendentes; registrar tempo de restauração. Não alegar cobertura ou segurança sem essa prova.
4. Preparar banco e runtime de homologação sem portas acessíveis publicamente e com dados fictícios ou sanitizados. Não ligar branches de teste a credenciais de produção.
5. Definir RPO/RTO por cenário com o responsável e medir resultados nos testes; registrar falha residual de dispositivo isolado ainda não sincronizado.

## 6. Sequência de entregas técnicas

**Fase A — diagnóstico fechado:** mapa de tabelas/API/clientes diretos, integrações, jobs e anexos; topologia do servidor e limites; matriz módulo x dependência x operações offline.

**Fase B — proteção verificável:** backup completo, cópia fora do nó, restauração provada e procedimento de recuperação; sem migração de produção.

**Fase C — piloto técnico em isolamento:** executar API/Next.js de produção e banco de teste locais, sem usar `dev:lan` como solução final; primeiro fluxo com dados fictícios, outbox/inbox e status visual; smoke test online/local e bloqueios de duplicação.

**Fase D — expansão por módulo:** orçamentos, clientes, obras, medições, produção, materiais/perfis/acessórios com imagens, compras, estoque, financeiro, vendas, serviços e demais módulos inventariados. Cada entrega terá regressão e documentação próprias; nada já funcional será removido.

**Fase E — mobilidade e entrada em uso:** dados pré-baixados, coleta de fotos offline, limites por dispositivo, sincronização WAN/LAN quando permitida, piloto supervisionado, teste de energia/servidor/rede e retorno seguro. Publicação em produção somente com avaliação e aprovação específicas.

## 7. Cenários obrigatórios de aceitação

- Desligamento da WAN antes, durante e depois de gravações; operação interna continua sem acesso externo.
- Edições externas enquanto o servidor local está isolado, seguidas de reconciliação sem descarte.
- Reenvio de operação e crash/reinício com fila pendente sem duplicar financeiro, estoque ou Kanban.
- Edições concorrentes e exclusão concorrente; conflitos visíveis, sem resolução silenciosa.
- Números conflitantes, estoque insuficiente e confirmação provisória indicados corretamente.
- Anexo interrompido, disco cheio, relógio divergente e erro de autenticação offline.
- Restauração de backup com anexos e pendências; RPO/RTO medidos.
- Verificação de todo o escopo, inclusive catálogo de perfis e acessórios com imagens reais correspondentes.

## 8. Situação e próximos critérios de passagem

Esta branch **documenta diagnóstico e arquitetura candidata, não implementa modo offline e não representa aprovação de publicação**. Nenhum backup completo, restauração, ambiente local isolado, novo serviço Windows ou migração foi realizado. Para avançar em mudanças no ambiente existente: identificar instalação de banco/backup apropriada, verificar cópia recuperável, demonstrar restauração isolada e confirmar recursos suficientes sem afetar SQL Server ou outras aplicações da empresa.

**Regras de execução:** mudanças aditivas, branch isolada, verificação funcional e rollback de versão sem apagar operações novas; não editar `main` diretamente; não realizar deploy neste trabalho.
