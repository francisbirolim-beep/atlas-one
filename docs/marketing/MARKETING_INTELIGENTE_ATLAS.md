# Atlas One — Marketing Inteligente Esquadrifácio®
## Plano de especialistas e integração — proposta de desenvolvimento
**Data:** 17/10/2026 · **Situação:** arquitetura documentada em branch isolada; nenhum canal conectado ou publicação iniciada.

### Decisão de estrutura
Reaproveitar o especialista geral `Atlas Marketing` existente em `lib/ai/specialists.ts` como **diretor/orquestrador**. Criar **oito especialidades subordinadas** (total: **nove papéis de IA**, não nove servidores permanentemente ativos). O catálogo inicial, sem execução automática, está em `lib/marketing/equipeEspecialistas.ts`.

| # | Especialista | Responsabilidade principal |
|---|---|---|
| 1 | Diretor de Marketing IA | Estratégia, distribuição de trabalho, calendário e aprovação do mês. |
| 2 | Conteúdo e Redação | Legendas, textos comerciais, roteiros e chamadas para orçamento. |
| 3 | Designer e Fotografia IA | Biblioteca e tratamento de fotos, mantendo originais e antes/depois. |
| 4 | Videomaker IA | Reels, Stories, clipes e versões por proporção. |
| 5 | Gestor de Redes Sociais | Publicação multicanal, agendamentos, status e tentativas seguras. |
| 6 | SEO Local e Google | Pesquisa orgânica, Google Business Profile, páginas de cidades atendidas. |
| 7 | Webmaster e Conversão | Site público, páginas de produtos, obras, WhatsApp e experiência mobile. |
| 8 | Performance e Tráfego | Analytics, conversões, leads, vendas atribuídas e propostas de anúncios. |
| 9 | Engenheiro de Integrações Atlas | CRM, obras concluídas, conteúdo, permissões, auditoria e conectores. |

### Integrações e fonte da verdade
- **Atlas One (privado)**: administração, aprovação de mídia, campanha, programação, vínculos `obra_id`/`cliente_id`, `crm`, oportunidade, orçamento, venda e autorizações.
- **Site Esquadrifácio® (público)**: visual **claro, sofisticado, branco/marfim, verde-água suave e grafite**, com marca e identidade aprovadas; vitrine de produtos/obras e formulário/WhatsApp rastreável, sem expor dados internos do Atlas.
- **Fluxo de obra**: instalação concluída + mídia disponível → sugestão de publicação. Não publicar automaticamente, sobretudo sem autorização do cliente e checagem de imagem.
- **Fluxo de origem comercial**: links de campanha com parâmetros UTM ou identificador; contato no WhatsApp/CRM vincula a origem quando tecnicamente observável; relatório distingue lead atribuído de estimativa. Não presumir que qualquer conversa veio de uma campanha.
- **Redes**: Instagram/Facebook, TikTok e Perfil da Empresa no Google, somente por APIs oficiais ou serviço intermediário autorizado. Cada integração tem suas permissões, disponibilidade e limitações; indisponibilidade gera pendência, jamais falso "publicado".
- **IA Atlas**: manter `marketing` como módulo existente e evitar criar outro com nome concorrente. Especialistas de marketing ficam sob o mesmo domínio e respeitam as permissões existentes, refinadas em etapa posterior.

### Fluxo operacional mensal
1. Carregar fotos e vídeos por lote, com metadados de obra, produto, cidade e direitos.
2. Preservar arquivo original. IA pode gerar versões tratadas sem alterar características reais da esquadria.
3. Especialistas criam propostas para 30 dias, imagens, vídeos, textos, calendários e canais.
4. Francis revisa cada peça ou aprova campanha inteira; mudança posterior importante volta para revisão.
5. Agendador executa somente itens aprovados nos canais conectados; mantém histórico, retry idempotente, alerta de falha e pausa.
6. Webmaster propõe renovação editorial do site mantendo a identidade visual. Mudança estrutural exige aprovação.
7. Performance cruza cliques e visitas com CRM, orçamentos, oportunidades e vendas, com limites de observabilidade e privacidade.
8. Mês seguinte: IA analisa resultados e sugere nova campanha para aprovação.

### Regras inegociáveis
- Não alterar `main`, Kanban, orçamento, engenharia, compras, materiais, financeiro, permissões existentes ou fluxos homologados.
- Todo desenvolvimento em branch isolada; testes locais (`npm run release:check`), comparação de regressão, PR e homologação manual; deploy somente com aprovação.
- Não armazenar tokens de redes no frontend; proteger OAuth e registrar operações sensíveis.
- LGPD/consentimento para obra, endereço, pessoas, rostos, placas e dados de clientes. Não publicar fotografia privada apenas porque consta no cadastro.
- Não criar obra fictícia nem modificar geometria de esquadrias para parecer produto executado. Identificar criações sintéticas quando necessário.
- Anúncios: orçamento/teto/mudanças e autorização humana expressa antes de qualquer gasto.
- Marca Esquadrifácio®: usar o símbolo somente sob a premissa de registro efetivo no INPI.
- Dados públicos do negócio editáveis pela administração, com log e histórico; alterações nos dados oficiais passam por aprovação.

### Etapas de implementação e aceites
**Fase 1 — Base isolada:** catálogo dos nove papéis, especificação, prova de conceito de Biblioteca, Calendário e Aprovações, reuso da última prévia visual aprovada. **Critério**: não tocar a produção existente.

**Fase 2 — Site e conteúdo:** páginas de produtos, obras e contato, fotos/vídeos, tratamento assistido, revisão editorial, SEO técnico/local, responsivo, desempenho. **Critério**: site de teste aprovado, sem publicação externa.

**Fase 3 — Atlas ↔ marketing:** novas tabelas/migrations aditivas de mídias, campanhas, aprovações, agendamentos, consentimentos, origens de lead e eventos; segurança, empresa_id, auditoria; leitura mínima necessária do CRM/obras. **Critério**: testes autenticados com registros fictícios e sem alterar dados reais.

**Fase 4 — Redes/agendamento:** integração autorizada canal a canal, renovação de tokens, falhas, reenvio sem duplicação, pausa e fila. **Critério**: uma publicação real de teste por canal após consentimento específico e revisão dos requisitos da API.

**Fase 5 — Medição e operação mensal:** analytics, painel de resultados, geração da próxima campanha e rotinas de acompanhamento. **Critério**: atribuição auditável (quando possível), logs e reversão testada.

### Estado desta entrega
- Identificados no repositório: especialista `Atlas Marketing` em `lib/ai/specialists.ts`, módulo `marketing` no tipo `AIModulo` e permissões de marketing em `lib/permissoesBlocos.ts`.
- **Criado somente o catálogo declarativo de nove papéis**. Ele não executa agentes, não conecta contas, não gera calendário real e não altera a interface atual. Integrações, UI e publicações são etapas futuras.
