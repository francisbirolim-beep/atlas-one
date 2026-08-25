# IMPLEMENTATIONS.md — Atlas One

> Histórico anterior preservado integralmente em `docs/ai-handoff/archive/2026-08-23-pre-pr258-IMPLEMENTATIONS.md`.

## 2026-08-25 — Modo Venda Balcão integrado ao Atlas

- consolidada a decisão de manter **um único Atlas One**, com o PDV como modo operacional e não como sistema/banco separado;
- `BalcaoShell` passa a identificar explicitamente `Modo Venda Balcão`;
- adicionado botão `Voltar ao Atlas`, retornando ao ERP completo pela rota `/`;
- menu móvel também recebe acesso direto `Atlas`;
- adicionada seção `Gestão compartilhada` no menu do balcão, apontando para as telas existentes do Atlas:
  - Clientes (`/clientes`);
  - Produtos / Cadastros (`/cadastros`);
  - Estoque (`/estoque`);
  - Compras / NF (`/compras`);
- esses acessos usam os mesmos produtos, clientes, unidades, estoque, compras e financeiro já existentes; não foi criado dado duplicado;
- fiscal/NFC-e/NF-e continua evolução posterior, após definição do provedor e das regras fiscais.

---

## 2026-08-23 — PR #260 — Orçamento visual + variáveis W.Vetro

### Seleção visual de tipologias
- criado `SeletorEsquadriaInteligenteV2.tsx` e ativado por compatibilidade pelo componente existente;
- tipologias da Linha passam a aparecer em cards visuais;
- mantido select textual como fallback/lista rápida;
- adicionados busca, filtros de status/origem/imagem e ordenação por prioridade técnica;
- cards exibem status Atlas/W.Vetro, número de configurações validadas, ocorrência histórica e origem da imagem;
- precedência de imagem: Atlas tipologia → configuração/produto Atlas → W.Vetro → placeholder;
- lightbox para ampliar imagem sem depender de hover.

### Referência segura de variáveis
- criada tabela `wvetro_referencias_variaveis` com RLS fechado para cliente e operação server-side;
- migrations:
  - `20260824022150_wvetro_variaveis_orcamento_v1`;
  - `20260824022234_wvetro_variaveis_folhas_normalizacao_v1`;
- função `fn_wvetro_reconstruir_variaveis_explicitas()` extrai apenas fatos escritos explicitamente no Modelo W.Vetro;
- nenhum fuzzy/inferência livre é promovido automaticamente;
- base histórica atual gerou 57 referências explícitas de número de folhas, normalizadas de 1 a 8;
- catálogo global de opção `folhas` passou a representar 1..8 quando esses valores apareceram explicitamente na origem, sem validar receitas.

### Configurar variáveis
- criado endpoint autenticado `/api/orcamento/wvetro-referencias` para expor somente referências seguras;
- UI unifica variáveis Atlas e referências W.Vetro;
- valor Atlas existente nunca é sobrescrito pela referência;
- W.Vetro preenche somente valor ainda vazio ao abrir modo assistido;
- selo distingue `ATLAS`, `WVETRO REFERÊNCIA` e valor `AJUSTADA`;
- evidência de origem fica visível;
- ausência de dado permanece `A definir`.

### Procedência do orçamento
- `lib/orcamentos.ts` passa a guardar no snapshot de cada item a referência W.Vetro realmente utilizada;
- snapshot inclui Linha/Modelo, IDs, variáveis usadas, valor bruto, origem e evidência;
- referência só é marcada `utilizada_como_base` se não houver configuração Atlas validada e algum valor W.Vetro tiver sido efetivamente usado;
- falha ao obter metadados de procedência não bloqueia criação do orçamento.

### Auditoria
- após cada lote histórico da auditoria W.Vetro e ao finalizar, referências explícitas são reconstruídas;
- futuras imagens/modelos encontrados pela auditoria passam a alimentar o mesmo fluxo visual, sem sobrescrever conhecimento Atlas validado.

### Validação
- banco aplicado com sucesso;
- PR #260 aberta aguardando Build Validation + preview Vercel antes de merge.

---

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
  - `20260824012923_wvetro_imagens_snapshot_v1`;
  - `20260824014055_wvetro_referencias_indices_v1`;
- cinco FKs novas da camada W.Vetro apontadas pelo advisor de desempenho foram indexadas pela última migration.

### Auditoria viva
- criada tela Master `/configuracoes/integracoes/wvetro/auditoria`;
- consulta linhas da API, pedidos/orçamentos em lotes de até 90 dias, produtos por código, componentes, vidros e imagens;
- tenta descobrir catálogo completo de Perfis/Acessórios; item novo entra apenas como referência importada, sem custo/margem/unidade operacional inventados;
- snapshots preservam payload, LinhaId/LinhaNome, NCM/unidade de origem e URL;
- imagens podem ser copiadas para o bucket `fotos`, sem sobrescrever foto Atlas existente;
- vínculo produto↔linha somente por campo explícito/igualdade exata; fuzzy continua proibido.

### Orçamento
- seletor de tipologia passou a mostrar procedência/estado técnico:
  - `REFERÊNCIA WVETRO`;
  - `WVETRO · EM VALIDAÇÃO ATLAS`;
  - `WVETRO · VALIDADA ATLAS`;
  - `VALIDADA ATLAS`;
  - `CADASTRADA ATLAS`.
- fórmulas/configurações Atlas validadas mantêm prioridade absoluta sobre a referência W.Vetro.

### Segurança / validação
- tabelas novas com RLS e acesso operacional server-side/service-role;
- advisor de segurança não apontou ERROR novo específico da camada W.Vetro;
- nenhuma atualização automática de custo/preço/unidade operacional foi adicionada;
- execução viva final da API permanece para ser disparada por usuário Master autenticado.

Relatório: `docs/tecnico/auditoria-wvetro-completa-2026-08-23.md`.

## Implementações imediatamente anteriores

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão.
- PR #257: estoque multiunidade, endereçamento, reservas e transferências.
- PR #256: Venda Balcão multiunidade, caixas, estoque da rede e atendimento de vendas reservadas.

Para o histórico cronológico completo anterior a este checkpoint, consultar o arquivo de archive indicado no topo.
