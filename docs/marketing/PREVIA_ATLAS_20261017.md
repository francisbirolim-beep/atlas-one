# Marketing Inteligente — Entrega em prévia 17/10/2026

## Funcional hoje, somente na branch
- Acesso `/marketing-inteligente` com menu Master, guard por setor Marketing.
- Catálogo com nove especialistas, sem chamadas automáticas a modelos.
- Biblioteca de fotos e vídeos armazenada localmente no navegador (IndexedDB), sem serviço externo.
- Identificação de obra e confirmação declarada do direito de uso; rascunhos não devem ser confundidos com prova jurídica de consentimento.
- Demonstração de filtro de iluminação/contraste na foto, sem gerar versão final e sem alterar original.
- Calendário editorial de rascunhos criado a partir de mídias marcadas como autorizadas; edição e aprovação local por item ou por mês; desligado por padrão.
- Configuração local de textos e WhatsApp, sem salvar no site.
- Resultados exibem integrações pendentes, não dados fictícios.

## Não implementado nem ativado
- Integração de mídias com armazenamento online ou sincronização entre aparelhos.
- Inteligência artificial gerativa real para foto, vídeo ou legendas.
- Publicação automática em Instagram, Facebook, TikTok, Google ou no site.
- Integração real com CRM, obras concluídas, WhatsApp, vendas e analytics.
- Atualização do site público e seus conteúdos aprovados anteriormente.

## Critérios de segurança
Sem acesso a produção, sem credenciais externas, sem alterações no banco, sem orçamento de anúncios. O Master aprova alterações antes de deploy. Não mostrar métricas simuladas como reais. Verificação de permissão no frontend não substitui políticas RLS/backend futuras. A biblioteca local é apenas para homologação; não enviar dados sensíveis de clientes.

## Continuação de 18/10/2026 — Backend candidato, totalmente desligado
- Migration aditiva `20261018100000_marketing_inteligente_base_v1.sql` **somente no repositório**, não aplicada em produção ou homologação.
- Tabelas privadas `marketing_midias`, `marketing_publicacoes` e `marketing_eventos`, por `empresa_id`, com registro transacional de eventos, revisões otimistas e checagem de consentimento documentado.
- Alterações relevantes reabrem a revisão do conteúdo; revogar autorização da mídia devolve aprovações vinculadas ao estado de rascunho.
- Bucket `atlas-marketing` privado proposto na migration, sem política direta de acesso no navegador e sem uploads ativos.
- Endpoint servidor `/api/marketing/editorial`, com autenticação Supabase, permissões de consulta/edição por setor, filtros de empresa, revisão e aprovação. **Inativo por padrão**. Somente após migração, storage, auditoria e testes reais, configurar `MARKETING_BACKEND_ENABLED=true` no ambiente de homologação; nunca habilitar em produção sem autorização.
- A UI da fase 1 ainda utiliza apenas IndexedDB/localStorage, sem rede; nenhum dado foi migrado automaticamente.
- Testes: `npm run test:marketing` (rascunhos, validações, permissões, API simulada e invariantes estáticas SQL); `npm run test:ia-relatorios` mantém 67 verificações existentes. Os testes de SQL são estáticos e **não substituem execução em PostgreSQL de homologação**.
- Não alteramos as rotas antigas de CRM, WhatsApp, compras, engenharia ou produção. CI recebeu somente um passo de teste aditivo. PR permanece draft.

## Continuação de 18/10/2026 (tarde) — Envio privado de fotos e vídeos (código candidato)
- Nova API **desligada** `/api/marketing/midias` com POST autenticado para 1 original por solicitação, GET autenticado para link temporário de 60 s e PATCH autenticado para registrar ou revogar direitos de divulgação.
- O servidor verifica permissões por empresa e setor, obra da mesma empresa, formatos permitidos (JPEG/PNG/WebP/MP4/MOV/WebM), cabeçalho binário do conteúdo, limite de 30 MB, hash SHA-256, nome e caminho de armazenamento gerado pelo servidor.
- O arquivo original é enviado ao bucket privado `atlas-marketing` **somente depois** da autenticação e das validações. Ausência de autorização explícita mantém a mídia bloqueada para aprovação. A API não trata a imagem por IA, não posta em redes nem expõe URL pública permanente.
- Em falha ao registrar no banco após subir o original, o servidor tenta remover o objeto do bucket. Erros de remoção devem ser monitorados em homologação para reconciliação de órfãos.
- A mídia agora inclui `versao` para atualização concorrente segura de consentimento; as postagens associadas aprovadas voltam a rascunho quando os direitos são revogados pela trigger.
- `npm run test:marketing` inclui agora testes simulados da API de upload, MIME real, tamanho, ACL de empresa, autorização, URL temporária e compensação após falha. `npm run test:ia-relatorios` preserva os testes dos módulos existentes.
- Nenhum storage real, RLS, migration, token de rede social, domínio público ou fluxo publicado foi alterado. UI original da prévia continua usando IndexedDB até validação de ponta a ponta.
- Necessário ANTES de liberar: reconciliar 11 migrações históricas aplicadas ausentes na branch/main com SQL **idêntico ao original**; homologar PostgreSQL e bucket isolado, testar com dois usuários/empresas, mídia malformada, concorrência, revogação, rollback e reinício do dispositivo.
