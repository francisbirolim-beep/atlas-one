# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar e concluir PR #260: Orçamento visual + variáveis W.Vetro

### Base concluída

- PR #255 integrada: Compras/Financeiro/Estoque/custo médio + precificação balcão;
- PR #257 integrada: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256 integrada: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento entre lojas;
- PR #258 integrada na `main`: referência/auditoria completa W.Vetro;
- PR #259 é somente especificação da evolução visual/W.Vetro;
- PR #260 contém a implementação operacional atual.

## PR #260 — estado

Branch: `feat/orcamento-tipologias-visuais`

Implementado:

1. cards visuais de tipologia por Linha;
2. busca e filtros;
3. prioridade de imagens Atlas → configuração/produto Atlas → W.Vetro → placeholder;
4. lightbox de imagem;
5. endpoint server-side autenticado `/api/orcamento/wvetro-referencias`;
6. staging `wvetro_referencias_variaveis` protegido por RLS/service_role;
7. extração somente de dados explicitamente escritos no Modelo W.Vetro;
8. normalização de número de folhas;
9. base atual: 57 referências explícitas de folhas, valores 1..8;
10. botão `Configurar variáveis` unifica Atlas + W.Vetro com procedência visível;
11. valores W.Vetro só preenchem campos vazios;
12. configuração Atlas validada sempre tem prioridade;
13. snapshot do orçamento preserva referência W.Vetro e evidência efetivamente usada;
14. auditoria W.Vetro reconstrói referências explícitas após lote de período e ao finalizar.

Migrations já aplicadas e versionadas:

- `20260824022150_wvetro_variaveis_orcamento_v1`;
- `20260824022234_wvetro_variaveis_folhas_normalizacao_v1`.

## Antes do merge #260

1. confirmar `Build Validation` verde no HEAD final;
2. confirmar `Supabase Database Control` verde no HEAD final;
3. confirmar preview Vercel `READY` no HEAD final;
4. se build falhar, corrigir TypeScript sem contornar checagens;
5. testar no preview `/orcamento-rapido`:
   - selecionar Linha Suprema;
   - confirmar cards visuais;
   - testar busca/filtros;
   - selecionar tipologia com status W.Vetro;
   - abrir `Configurar variáveis`;
   - confirmar pré-carga de `folhas` quando explícita;
   - alterar valor e confirmar mudança de procedência visual;
   - confirmar que configuração Atlas validada não é substituída;
   - testar descrição livre;
   - testar mobile;
6. confirmar PR mergeable e HEAD estável;
7. merge manual somente depois dos gates.

## Imagens W.Vetro

A base histórica inicial possui `imagem_url` nula para várias/maioria das referências de tipologia. Portanto os cards podem mostrar placeholder até a auditoria viva ser executada.

Usuário Master deve executar:

`/configuracoes/integracoes/wvetro/auditoria`

A auditoria percorre pedidos/orçamentos atuais e preserva URLs/imagens encontradas. Imagem Atlas existente nunca deve ser sobrescrita automaticamente.

## Depois da PR #260

Próxima evolução recomendada, mantendo PR pequena:

1. criar tela de revisão de referências W.Vetro para Engenharia;
2. permitir validar/promover mapeamentos de variável/opção individualmente;
3. cadastrar regras Atlas determinísticas para inferências a partir de componentes, sempre com revisão humana antes de uso técnico;
4. mostrar histórico/ocorrência dos componentes por Linha+Modelo;
5. ampliar biblioteca oficial de imagens de tipologias;
6. validar tipologia por tipologia, priorizando Suprema mais usada;
7. retomar validação operacional da NF real 3128;
8. validar Plano de Corte A4 PC2/PC3/PC4 Suprema;
9. continuar validação estrutural Suprema 3F–9F;
10. validar Central do Cliente e Assistência em campo;
11. definir permissões específicas de Compras/Financeiro;
12. tratar hardening legado da Engenharia isoladamente.

## Regras invioláveis

- W.Vetro é referência; Atlas validado é fonte técnica oficial.
- Sem fuzzy como vínculo automático.
- Sem adivinhar variável ausente.
- Sem promover custo/preço/unidade/fórmula automaticamente.
- Valor inferido só pode ser usado quando existir regra Atlas determinística validada.
- Imagem W.Vetro nunca substitui foto Atlas validada automaticamente.
