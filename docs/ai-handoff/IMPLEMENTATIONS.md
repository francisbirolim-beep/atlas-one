# IMPLEMENTATIONS.md — Atlas One

> Histórico anterior preservado integralmente em `docs/ai-handoff/archive/2026-08-23-pre-pr258-IMPLEMENTATIONS.md`.

## 2026-08-23 — PR #258 — Auditoria completa W.Vetro → Atlas

Implementada a camada de referência completa W.Vetro sem substituir o conhecimento técnico validado no Atlas.

### Banco / proveniência
- formalizada a origem W.Vetro das 109 tipologias históricas extraídas de 1.038 vendas/orçamentos;
- criada referência auditável de linhas, tipologias, componentes, vidros e snapshots de produto da API;
- eliminada a lacuna de vínculo Linha↔Tipologia: 46/109 antes → 109/109 depois;
- após a migration: 60 linhas técnicas, 29 ativas, 55 exclusivamente W.Vetro e 4 mistas Atlas+W.Vetro;
- 64 valores brutos de Linha preservados no staging;
- catálogos conhecidos preservados: 1.307 perfis e 1.174 acessórios W.Vetro;
- migrations aplicadas e alinhadas ao histórico remoto:
  - `20260824012830_wvetro_referencia_completa_v1`;
  - `20260824012851_wvetro_staging_tipologias_componentes_v1`;
  - `20260824012908_wvetro_snapshots_api_v1`;
  - `20260824012923_wvetro_imagens_snapshot_v1`.

### Auditoria viva
- criada tela Master `/configuracoes/integracoes/wvetro/auditoria`;
- consulta linhas da API, pedidos/orçamentos em lotes de até 90 dias, produtos por código, componentes, vidros e imagens;
- tenta descobrir catálogo completo de Perfis/Acessórios; item novo entra apenas como referência importada, sem custo/margem/unidade operacional inventados;
- snapshots preservam payload, LinhaId/LinhaNome, NCM/unidade de origem e URL;
- imagens podem ser copiadas para o bucket `fotos`, sem sobrescrever foto Atlas existente;
- vínculo produto↔linha somente por campo explícito/igualdade exata; fuzzy continua proibido.

### Orçamento
- seletor de tipologia passa a mostrar procedência/estado técnico:
  - `REFERÊNCIA WVETRO`;
  - `WVETRO · EM VALIDAÇÃO ATLAS`;
  - `WVETRO · VALIDADA ATLAS`;
  - `VALIDADA ATLAS`;
  - `CADASTRADA ATLAS`.
- fórmulas/configurações Atlas validadas mantêm prioridade absoluta sobre a referência W.Vetro.

### Segurança / validação
- tabelas novas com RLS e acesso operacional server-side/service-role;
- executor temporário de preview usado apenas como tentativa de automação foi removido antes do merge;
- credenciais W.Vetro permanecem somente no ambiente Vercel;
- nenhuma atualização automática de custo/preço/unidade operacional foi adicionada;
- execução viva final da API permanece para ser disparada por usuário Master autenticado, pois o preview Vercel exige SSO/cookie persistente.

Relatório: `docs/tecnico/auditoria-wvetro-completa-2026-08-23.md`.

## Implementações imediatamente anteriores

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão.
- PR #257: estoque multiunidade, endereçamento, reservas e transferências.
- PR #256: Venda Balcão multiunidade, caixas, estoque da rede e atendimento de vendas reservadas.

Para o histórico cronológico completo anterior a este checkpoint, consultar o arquivo de archive indicado no topo.
