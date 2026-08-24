# CURRENT_STATE.md — Atlas One

> Checkpoint anterior preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-CURRENT_STATE.md`.

## EM VALIDAÇÃO — ORÇAMENTO VISUAL + VARIÁVEIS WVETRO / PR #260 — 2026-08-23

### Base já integrada na `main`

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão;
- PR #257: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento reservado;
- PR #258: auditoria completa W.Vetro integrada na `main` no commit `bb4bc98`.

### Referência W.Vetro disponível

- 1.307 perfis W.Vetro preservados;
- 1.174 acessórios W.Vetro + 3 acessórios exclusivos Atlas;
- 109 tipologias históricas W.Vetro;
- 109/109 vinculadas formalmente a Linha;
- 60 linhas técnicas no total, 29 ativas;
- 64 referências brutas de Linha preservadas;
- configuração/fórmula/receita validada Atlas sempre tem prioridade sobre W.Vetro;
- auditoria viva Master continua necessária para completar referências atuais da API, principalmente imagens, vidros e alterações posteriores aos exports históricos.

## PR #260 — `feat/orcamento-tipologias-visuais`

Objetivo: tornar a escolha de tipologia visual e aproveitar referências explícitas W.Vetro no botão `Configurar variáveis` sem transformar referência em receita validada.

### Seleção visual

Implementado em `components/orcamento/SeletorEsquadriaInteligenteV2.tsx` e ativado pelo re-export de `SeletorEsquadriaInteligente.tsx`:

- seleção da Linha mantida;
- `<select>` textual de tipologia mantido como lista rápida/fallback;
- fluxo principal passa a exibir cards visuais por Linha;
- busca textual dos cards;
- filtros: Todos, Validados Atlas, Em validação, W.Vetro, Com imagem, Sem imagem;
- ordenação prioriza status Atlas e depois ocorrência W.Vetro/alfabética;
- cards mostram nome, Linha, selo de procedência, quantidade de configurações Atlas e referência histórica W.Vetro;
- imagem segue prioridade: foto Atlas da tipologia → imagem de configuração/produto Atlas → imagem da referência W.Vetro → placeholder;
- imagem pode ser ampliada em lightbox; fecha por botão, clique externo ou ESC;
- descrição livre continua disponível e não é bloqueada pelo cadastro.

### Variáveis W.Vetro

Migrations já aplicadas no Supabase e versionadas na branch:

- `20260824022150_wvetro_variaveis_orcamento_v1`;
- `20260824022234_wvetro_variaveis_folhas_normalizacao_v1`.

Criada `wvetro_referencias_variaveis`:

- staging separado das variáveis/receitas oficiais Atlas;
- RLS habilitado;
- sem grants diretos para `anon`/`authenticated`;
- leitura operacional somente server-side/service-role;
- registra tipologia, variável Atlas mapeada, valor bruto/normalizado, evidência, origem, confiança e status.

Função `fn_wvetro_reconstruir_variaveis_explicitas()`:

- extrai somente informação explicitamente escrita no `Modelo` W.Vetro;
- não usa fuzzy e não inventa variável;
- reconhece número de folhas e termos técnicos quando escritos explicitamente, como montagem/trilho/contramarco/arremate/fechadura/puxador/mão de amigo/reforço/roldana;
- valores não encontrados permanecem `A definir`;
- número de folhas é normalizado sem zero à esquerda.

Na base histórica atual foram encontrados:

- 57 referências explícitas de `folhas`;
- valores canônicos de 1 a 8 folhas;
- opções de 1, 5, 6, 7 e 8 folhas foram adicionadas ao catálogo global porque apareceram de forma explícita na origem; isso NÃO valida nenhuma receita técnica.

### Configurar variáveis

- endpoint autenticado `/api/orcamento/wvetro-referencias` lê o staging com `service_role` e devolve somente dados seguros ao Orçamento;
- ao entrar em `Configurar variáveis`, Atlas e W.Vetro são unidos na UI;
- variável Atlas continua tendo prioridade;
- valor W.Vetro preenche somente campo ainda vazio;
- referência ativa recebe selo `WVETRO REFERÊNCIA`;
- se usuário alterar o valor, passa a `AJUSTADA`;
- evidência de origem é exibida;
- variável W.Vetro que não possui opção Atlas pode aparecer como referência, sem validar receita;
- quando não existe variável Atlas nem referência explícita W.Vetro, o fluxo não inventa nada e mantém `A definir`/modo rápido.

### Snapshot / procedência

`lib/orcamentos.ts` agora consulta o endpoint seguro uma vez no salvamento e grava dentro de cada item do orçamento:

- referência W.Vetro usada;
- Linha/Modelo de origem;
- IDs das referências;
- variáveis W.Vetro efetivamente usadas;
- valor bruto, normalizado, tipo de origem e evidência;
- `utilizada_como_base` somente quando não existe configuração Atlas validada e algum valor W.Vetro realmente foi usado.

Falha ao recuperar procedência não impede o salvamento do orçamento.

### Auditoria viva

`/api/integracoes/wvetro/auditoria` reconstrói as variáveis explícitas após cada lote de período e novamente ao finalizar. Assim novos modelos encontrados passam pelo mesmo processo auditável.

### Validação pendente da PR #260

- `Supabase Database Control` do primeiro head passou;
- novo head está aguardando Build Validation + Database Control;
- aguardar preview Vercel `READY`;
- testar `/orcamento-rapido` com Linha Suprema e tipologias W.Vetro;
- executar auditoria viva autenticada como Master para preencher imagens que ainda estão ausentes no staging histórico;
- só depois considerar merge.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- W.Vetro é referência/origem; Atlas validado é a versão técnica oficial.
- Nunca sobrescrever automaticamente fórmula, receita, custo, preço, margem ou unidade operacional Atlas com valor histórico W.Vetro.
- Variável inferida sem regra Atlas validada deve permanecer `A definir`.
- Associação externa automática somente por identidade segura/exata; sem fuzzy.
- Imagem W.Vetro nunca substitui automaticamente imagem Atlas existente.
- `produtos.unidade` é unidade operacional; `unidade_origem`/`qtde_embalagem_origem` são proveniência.
- Tipologia = custo técnico. Venda Balcão = preço comercial próprio.
- Hardening legado da Engenharia continua tarefa separada; não habilitar RLS às cegas.
