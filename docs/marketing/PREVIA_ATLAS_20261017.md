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