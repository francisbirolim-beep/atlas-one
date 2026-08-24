# CURRENT_STATE.md — Atlas One

> Checkpoint anterior preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-CURRENT_STATE.md`.

## EM VALIDAÇÃO FINAL — AUDITORIA COMPLETA W.VETRO / PR #258 — 2026-08-23

Objetivo atual: usar o W.Vetro como referência integral de Linhas, Tipologias, Perfis, Acessórios, Vidros e imagens, mantendo o Atlas como fonte técnica oficial depois de validação.

Estado real:
- PR #255 já integrada: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão separada do custo técnico;
- PR #257 já integrada: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256 já integrada: Venda Balcão multiunidade, caixas por unidade, consulta de estoque da rede e atendimento de venda reservada;
- PR #258 aberta em `feat/wvetro-auditoria-completa`;
- Build Validation da implementação funcional passou antes da aplicação das migrations; migrations depois foram alinhadas ao histórico real do Supabase;
- quatro migrations W.Vetro já aplicadas no Supabase e renomeadas no repositório para os números remotos reais:
  - `20260824012830_wvetro_referencia_completa_v1`;
  - `20260824012851_wvetro_staging_tipologias_componentes_v1`;
  - `20260824012908_wvetro_snapshots_api_v1`;
  - `20260824012923_wvetro_imagens_snapshot_v1`;
- catálogo conhecido preservado: 1.307 perfis W.Vetro e 1.174 acessórios W.Vetro + 3 acessórios exclusivos Atlas;
- 109 tipologias da extração histórica W.Vetro foram formalizadas sem alterar suas fórmulas/receitas;
- antes da PR apenas 46/109 tinham vínculo formal com linha; depois das migrations: 109/109;
- depois da carga existem 60 linhas técnicas no total, 29 ativas, 55 de origem exclusivamente W.Vetro e 4 de origem mista Atlas+W.Vetro;
- `wvetro_referencias_linhas` preserva 64 valores brutos de linha; diferenças de grafia/capitalização não são descartadas;
- staging inicial contém 109 referências de tipologia;
- referência de vidro continua zerada antes da execução viva, porque vidro não é inventado a partir de cadastro inexistente;
- nova tela Master `/configuracoes/integracoes/wvetro/auditoria` executa a auditoria viva em lotes, consultando `/Produtos/linhas`, catálogo P/A quando suportado, pedidos/orçamentos, `produtoByKey`, vidros e imagens;
- a auditoria pode importar código novo encontrado na API somente como `origem=wvetro`, `status_validacao=importado`, `unidade=NULL`, `preco=0`, sem custo/margem inventados;
- imagens W.Vetro são preservadas no snapshot e copiadas para o bucket `fotos` somente quando possível; foto Atlas existente não é sobrescrita;
- vínculos de Linha usam somente Linha explícita da API ou igualdade exata; nunca fuzzy;
- no orçamento, tipologias passam a exibir selo de procedência/validação: `REFERÊNCIA WVETRO`, `WVETRO · EM VALIDAÇÃO ATLAS`, `WVETRO · VALIDADA ATLAS`, `VALIDADA ATLAS` ou `CADASTRADA ATLAS`;
- configuração/fórmula/receita validada no Atlas sempre tem prioridade sobre a referência W.Vetro.

### Limitação ainda aberta

A execução viva da API não foi disparada pelo agente porque a rota é protegida por sessão Atlas Master e o preview Vercel exige SSO/cookie persistente. Um executor temporário restrito ao preview foi criado para teste, mas a ferramenta externa não conseguiu manter a sessão; ele foi removido antes do merge. A execução deve ser iniciada pela própria tela Master autenticada. Nenhuma credencial foi exposta ou proteção reduzida.

A execução viva deve fechar os números finais de:
- linhas retornadas por `/Produtos/linhas`;
- eventuais perfis/acessórios criados depois dos exports históricos;
- Linha+Modelo em todo o período auditado;
- referências de vidro;
- URLs/imagens encontradas e efetivamente copiadas;
- divergências que ainda precisam de validação humana.

Relatório detalhado: `docs/tecnico/auditoria-wvetro-completa-2026-08-23.md`.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- W.Vetro é referência/origem; Atlas validado é a versão técnica oficial.
- Nunca sobrescrever automaticamente fórmula, receita, custo, preço, margem ou unidade operacional Atlas com valor histórico W.Vetro.
- `produtos.unidade` é unidade operacional; `unidade_origem`/`qtde_embalagem_origem` são proveniência.
- Tipologia = custo técnico. Venda Balcão = preço de venda próprio; nunca aplicar margem de balcão dentro da tipologia.
- Associação externa somente por identidade segura/exata; sem fuzzy como vínculo automático.
- Hardening antigo da Engenharia continua tarefa separada; não habilitar RLS às cegas em tabelas legadas.
