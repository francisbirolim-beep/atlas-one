# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — concluir PR #258 e executar auditoria viva W.Vetro

### Base concluída

- PR #255 integrada: Compras/Financeiro/Estoque/custo médio + precificação balcão.
- PR #257 integrada: estoque multiunidade, endereçamento, reservas e transferências.
- PR #256 integrada: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento entre lojas.
- PR #258 (`feat/wvetro-auditoria-completa`) implementa referência completa W.Vetro e está na validação final.

### Estado real da PR #258

Migrations já aplicadas no Supabase e alinhadas aos números remotos:
- `20260824012830_wvetro_referencia_completa_v1`;
- `20260824012851_wvetro_staging_tipologias_componentes_v1`;
- `20260824012908_wvetro_snapshots_api_v1`;
- `20260824012923_wvetro_imagens_snapshot_v1`;
- `20260824014055_wvetro_referencias_indices_v1`.

Pós-carga validada:
- 1.307 perfis W.Vetro;
- 1.174 acessórios W.Vetro + 3 exclusivos Atlas;
- 109 tipologias W.Vetro;
- 109/109 vinculadas formalmente a Linha;
- 60 linhas técnicas no total;
- 29 linhas ativas;
- 64 referências brutas de Linha preservadas;
- 109 referências de tipologia no staging;
- vidros = 0 antes da auditoria viva;
- os 5 alertas de FK sem índice criados pela camada W.Vetro foram tratados em `20260824014055_wvetro_referencias_indices_v1`;
- advisor de segurança não apontou ERROR novo específico da camada W.Vetro; erros críticos remanescentes são legados da Engenharia.

Nova tela Master:
`/configuracoes/integracoes/wvetro/auditoria`

Ela deve:
1. consultar `/Produtos/linhas`;
2. tentar descobrir catálogo completo P/A;
3. percorrer pedidos + orçamentos em lotes de até 90 dias;
4. extrair Linha+Modelo, perfis, acessórios e vidros;
5. consultar `produtoByKey` para produtos conhecidos;
6. guardar LinhaId/LinhaNome, unidade/NCM de origem, payload e URL de imagem;
7. copiar imagem para Atlas quando possível sem sobrescrever foto existente;
8. importar eventual código novo apenas como `importado`, `unidade=NULL`, `preco=0`, sem custo/margem inventados;
9. fechar totais e pendências.

### Regra de procedência no orçamento

Mostrar:
- `REFERÊNCIA WVETRO`;
- `WVETRO · EM VALIDAÇÃO ATLAS`;
- `WVETRO · VALIDADA ATLAS`;
- `VALIDADA ATLAS`;
- `CADASTRADA ATLAS`.

W.Vetro é referência. Fórmula/receita/configuração Atlas validada sempre tem prioridade.

### Antes do merge #258

1. confirmar `Build Validation` verde no head limpo;
2. confirmar `Supabase Database Control` verde no head limpo;
3. confirmar preview Vercel `READY` no head limpo;
4. revalidar advisor de desempenho sem FKs W.Vetro pendentes;
5. confirmar PR mergeable/head estável;
6. merge manual;
7. confirmar deploy de produção `READY`.

> Checkpoint final de 23/08/2026: a `main` já contém #255, #257 e #256, mas o domínio de produção ainda estava publicado no commit da #253. Este commit de documentação também serve para disparar uma nova validação de preview da cabeça da #258 antes do merge, sem alterar regra de negócio.

### Depois do deploy

Usuário Master deve abrir `/configuracoes/integracoes/wvetro/auditoria` e clicar `Executar auditoria completa`.

A execução viva é necessária para fechar os números atuais da API: linhas retornadas, eventuais produtos novos desde os exports, referências de vidro e imagens. Ela não foi disparada pelo agente porque a rota exige sessão Master e o preview Vercel exige SSO/cookie persistente; nenhuma proteção deve ser reduzida para contornar isso.

Depois da execução, revisar os totais e iniciar validação técnica tipologia por tipologia, priorizando as mais usadas. Nunca promover custo/preço/unidade operacional automaticamente.

## DEPOIS

- retomar validação operacional da NF real 3128;
- validar Plano de Corte A4 PC2/PC3/PC4 Suprema;
- continuar validação estrutural Suprema 3F–9F;
- validar Central do Cliente e Assistência em campo;
- definir permissões específicas de Compras/Financeiro;
- tratar hardening legado da Engenharia em tarefa isolada, sem habilitar RLS às cegas.
