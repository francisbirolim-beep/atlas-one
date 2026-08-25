# DECISIONS.md — Atlas One

Decisoes tecnicas ja adotadas. Nao reverter/alterar sem necessidade real e sem entender o motivo abaixo.

## Venda Balcão é um modo do Atlas, não um sistema separado

O Atlas One possui um ambiente operacional próprio de Venda Balcão (`/balcao`), mas ele pertence ao mesmo produto, autenticação e base de dados do Atlas completo.

Regras permanentes:
- não criar banco, cadastro de produto, cadastro de cliente ou estoque duplicado para o PDV;
- Venda Balcão usa os mesmos produtos, clientes, unidades, locais de estoque, compras e financeiro do Atlas;
- `/balcao` usa interface/shell próprio, compacto e focado na operação de balcão;
- deve existir acesso claro `Voltar ao Atlas` para retornar ao ERP completo;
- cadastros e gestões compartilhadas podem abrir as telas completas do Atlas, preservando a mesma fonte de verdade;
- no futuro, planos comerciais podem ocultar módulos do ERP e expor apenas o ambiente PDV, sem duplicar o backend;
- emissão NFC-e/NF-e e demais recursos fiscais devem ser adicionados a esse mesmo núcleo, após definição de provedor e regras fiscais.

Motivo: a Esquadrifácio usa simultaneamente o ERP completo e vendas de balcão. Separar as bases criaria divergência de estoque, preço, cliente, compra e financeiro.

## Workflow de deploy
Nunca commitar direto em main. Sempre: branch nova -> PR -> aguardar build da Vercel no PR (preview) -> merge manual. Motivo: evitar quebrar producao com erro de TypeScript so descoberto no deploy.

## TipoEsquadria: union fixo -> string dinamica
TipoEsquadria era um union type fixo ('porta_correr' | 'porta_pivotante' | ... | 'outro'). Foi convertido para "export type TipoEsquadria = string" (lib/tipos.ts) para permitir tipologias criadas pelo usuario, SEM reescrever todas as comparacoes/atribuicoes existentes com os valores historicos abaixo. Os valores historicos ficaram documentados em comentario no proprio arquivo. Nao voltar a um union fixo — isso quebraria a feature de tipologias dinamicas (PR #28).

## Tabela tipologias como fonte da verdade
A lista de tipos de esquadria (antes hardcoded em ~5 arquivos diferentes) agora vive na tabela tipologias (chave, label, categoria, ordem), lida via lib/tipologias.ts (listarTipologias, criarTipologia). Cada tela que precisa da lista busca dinamicamente — nao reintroduzir arrays hardcoded de tipos nas telas.

## Campo categoria (porta/janela) em tipologias — deliberadamente NAO conectado ao calculo
Ao criar uma tipologia nova, o usuario escolhe categoria: 'porta' | 'janela'. Essa categoria e salva no banco mas lib/calculos.ts (formula de area/perimetro do orcamento) NAO le esse campo ainda — decisao deliberada por ser codigo sensivel de precificacao, para evitar quebrar calculo de orcamentos existentes sem validacao cuidadosa. Ver CURRENT_STATE.md e NEXT_TASK.md. Antes de conectar isso, entender bem lib/calculos.ts e testar com casos reais de porta vs janela.

## Criacao de Medicao Final e manual, nao automatica (ate o momento)
Apesar de existir a flag kanban_colunas.gera_medicao_final e uma tela dedicada de Medicao Final, a criacao do registro em medicoes_finais e feita sob demanda (botao "+ Nova" em /producao/medicao-final, que lista orcamentos "sem medicao" via listarOrcamentosSemMedicao). NAO ha trigger automatico hoje ao mover card no Kanban — isso e uma tarefa em aberto, ver NEXT_TASK.md. Se for implementado, deve ser fire-and-forget (nao bloquear a UI de mover o card) e idempotente (nao duplicar).

## Padrao "cache de modulo + estado do componente" para listas dinamicas
Quando uma pagina tem uma funcao helper fora do componente React (ex.: labelTipo(valor)) que precisa ler dados buscados de forma assincrona (ex.: tipologias do banco), o padrao usado e: variavel de modulo (let tiposCache: Tipologia[] = []) atualizada de forma sincrona no mesmo momento que o setState. Isso evita ter que mover a funcao helper para dentro do componente. Usar esse mesmo padrao em casos semelhantes, em vez de reescrever a estrutura da pagina.

## RLS aberto (using true / with check true)
As tabelas tem RLS habilitado mas com policy permissiva total. Isso foi uma decisao pragmatica do estagio atual do projeto (app interno, poucos usuarios). Nao assumir que RLS protege dados — se for necessario reforcar seguranca, isso e uma mudanca deliberada a ser discutida, nao um "conserto" incidental.

## Migrations aplicadas direto no banco (sem arquivo .sql commitado)
A partir da v16, varias migrations foram aplicadas diretamente via ferramenta MCP do Supabase (apply_migration) sem gerar um arquivo supabase-migration-v*.sql correspondente no repo. Isso e uma divida tecnica conhecida (ver CURRENT_STATE.md), nao uma recomendacao — idealmente, migrations futuras deveriam voltar a ser commitadas como arquivo .sql no repo para manter o historico completo e permitir recriar o schema do zero se necessario.

## Plano de Corte: produto + receita mestre + variaveis + snapshot
O Plano de Corte nao pode ser tratado como uma formula unica por tipologia generica. O produto cadastrado e o ponto de entrada operacional (ex.: Porta de Correr 03 Folhas Moveis | Suprema), e a receita deve considerar as variaveis que alteram geometria e componentes: linha, folhas, montagem, trilho, contramarco, arremate, fechadura, puxador, mao-de-amigo/reforcos, travessas e roldanas.

Regras permanentes:
- pesquisar/selecionar o produto cadastrado primeiro;
- receita mestre define componentes, variantes e formulas validadas;
- variaveis escolhem a variante correta da receita;
- o plano de producao e um snapshot editavel da receita naquele momento;
- alterar perfil, acessorio, folga ou corte no snapshot nao altera silenciosamente a receita mestre;
- somente Master ou usuario com permissao de edicao em Producao pode alterar o plano; consulta apenas visualiza;
- formula sem evidencia tecnica suficiente deve permanecer pendente, nunca gerar medida inventada.

Motivo: relatorios reais do W.Vetro da Porta de Correr 03 Folhas Suprema mostraram que duas configuracoes com o mesmo vao podem gerar larguras de folha diferentes quando muda o tipo de mao-de-amigo/reforco. Portanto, uma receita apenas por `tipologia_id` e insuficiente como modelo final. A evolucao do schema deve permitir receitas/variantes orientadas ao produto e suas variaveis, preservando fallback generico quando fizer sentido.

## Identidade tecnica de Produto: dados_origem como jsonb na propria tabela
Para preservar proveniencia sem criar uma camada historica complexa agora, foi escolhido um campo `produtos.dados_origem jsonb` em vez de uma tabela `produto_origens` separada.

A reconciliacao de acessorios em 2026-08-16/17 corrigiu uma premissa importante: **nao e permitido rotular automaticamente o snapshot dos produtos preexistentes como "o que veio exatamente do W.Vetro"**. Os 392 acessorios atuais estavam todos com `unidade = UN`, mas a fonte completa mostrou 93 correspondencias com unidade MT/PR/TB/BR/PT/PC; alem disso, 3 codigos atuais nao aparecem na fonte completa.

Regra atual:
- importacao externa nova/reconciliada: `dados_origem` deve guardar os valores crus reais da fonte;
- produto tecnico preexistente ainda nao reconciliado: pode guardar snapshot do estado legado do Atlas, mas deve identificar explicitamente `snapshot_tipo = atlas_legacy_pre_reconciliacao`;
- nunca fingir que um valor legado/default/placeholder e dado cru W.Vetro;
- se no futuro for necessario manter multiplas versoes/importacoes por produto, evoluir para tabela dedicada.

## Identidade tecnica de Produto: origem legado ate confirmacao
O padrao visual `CODIGO - DESCRICAO` nao prova a origem externa do registro. A reconciliacao encontrou `TELA-1000-GALV`, `TELA-132` e `TELA-254` no Atlas sem correspondencia na base completa de acessorios W.Vetro.

Portanto:
- `codigo` pode ser inferido do nome legado quando o formato for inequívoco;
- `codigo_origem` pode preservar o codigo legado conhecido;
- produtos tecnicos preexistentes ficam com `origem = legado` ate a origem externa ser confirmada;
- somente uma correspondencia/source real permite mudar para `origem = wvetro`;
- `id_externo_wvetro` so recebe uma chave externa real, nunca o codigo tecnico usado como substituto.

## Unidade operacional x unidade de origem
`produtos.unidade` e um campo operacional do Atlas. A Engenharia copia `produto.unidade` para a unidade do componente quando o usuario seleciona um produto numa receita; por isso uma alteracao em lote pode se propagar para receitas e Plano de Corte.

A fonte `ExportWWAcessorios.xlsx` possui `UN` e tambem `Qtde Emb.`. Entre os 93 divergentes de unidade, ha exemplos com `PT` e Qtde Emb. 121/89, `PC` e Qtde Emb. 8, e `MT` com Qtde Emb. 50/1. A semantica exata de embalagem/compra/consumo nao deve ser inventada.

Decisao:
- `produtos.unidade` permanece unidade operacional/canonica do Atlas ate validacao;
- `produtos.unidade_origem` guarda exatamente a unidade da fonte externa;
- `produtos.qtde_embalagem_origem` guarda exatamente `Qtde Emb.`;
- esses campos de origem nao sobrescrevem automaticamente `produtos.unidade`;
- se Compras/Estoque exigirem unidade de compra, unidade de estoque e fator de conversao, esses conceitos devem ser modelados explicitamente depois de validacao operacional.

## Identidade tecnica de Produto: codigo nao substitui nome
`produtos.codigo`/`codigo_origem` foram adicionados como colunas novas. `nome` continua sendo a fonte visual usada em todo o app (selects de Engenharia/Plano de Corte, cards de Cadastro). Nao remover o codigo de dentro de `nome` -- isso quebraria a exibicao em varias telas que hoje dependem apenas de `produto.nome`.

## Identidade tecnica de Produto: unique index em codigo so depois de auditar
Antes de criar `uq_produtos_codigo_upper`, foi rodada uma auditoria completa confirmando 0 duplicidade de `codigo` (case-insensitive) nos 1.700 produtos existentes, inclusive sem colisao entre categorias diferentes (perfil vs acessorio). Se uma futura importacao (ex.: `ExportWWAcessorios`) revelar colisao, tratar como dado a revisar antes de forcar o insert -- nao relaxar o unique index sem entender a causa.

## NCM: nunca inferir "valido" automaticamente
`ncm_status` so e marcado `invalido` quando o valor e inequivocamente placeholder (`0`, vazio, `12345678`, `12345667`). Nunca e marcado `valido` automaticamente so por ter 8 digitos numericos -- isso nao prova correcao fiscal. Todo NCM que nao e claramente placeholder fica `pendente` ate revisao humana. Mesma logica se aplica a peso de perfil fora de faixa plausivel (> 50 kg): o valor nunca e alterado ou zerado, so sinalizado via `observacao_validacao`.

## PRODUTOS — UNIDADE OPERACIONAL PENDENTE — 2026-08-17

`produtos.unidade = NULL` significa unidade operacional ainda não definida. Não significa `UN` e não autoriza copiar `unidade_origem`.

Produtos sem unidade operacional não devem participar de fluxos técnicos/comerciais que exijam unidade. `unidade_origem` e `qtde_embalagem_origem` permanecem dados de proveniência; conversão só pode ser criada após validação operacional.
