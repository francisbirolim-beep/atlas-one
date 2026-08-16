# DECISIONS.md — Atlas One

Decisoes tecnicas ja adotadas. Nao reverter/alterar sem necessidade real e sem entender o motivo abaixo.

## Workflow de deploy
Nunca commitar direto em main. Sempre: branch nova -> PR -> aguardar build da Vercel no PR (preview) -> merge manual. Motivo: evitar quebrar producao com erro de TypeScript so descoberto no deploy.

## TipoEsquadria: union fixo -> string dinamica
TipoEsquadria era um union type fixo ('porta_correr' | 'porta_pivotante' | ... | 'outro'). Foi convertido para "export type TipoEsquadria = string" (lib/tipos.ts) para permitir tipologias criadas pelo usuario, SEM reescrever todas as comparacoes/atribuicoes existentes no codigo (que continuam funcionando pois string aceita qualquer valor). Os valores historicos ficaram documentados em comentario no proprio arquivo. Nao voltar a um union fixo — isso quebraria a feature de tipologias dinamicas (PR #28).

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
