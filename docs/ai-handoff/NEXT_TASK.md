# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/remover-medida-final-duplicada`.

O usuario confirmou pelo print que a Medicao Final correta e a tela oficial em `/producao/medicao-final`, com `Nova medição`, colunas operacionais e cards reais. A antiga entrada `Medida final` que abria um Kanban generico vazio nao sera usada.

## IMPLEMENTADO NA BRANCH ATUAL
1. A Medicao Final oficial foi adicionada como pagina fixa de navegacao/favoritos em `/producao/medicao-final`.
2. `listarSetores()` filtra o setor legado chamado `Medida final` ou `Medicao final` quando ele nao aponta para a rota oficial.
3. Como Sidebar, Favoritos, Setores, Inicio e outras areas usam `listarSetores()`, a duplicata deixa de aparecer globalmente nessas listas.
4. O Kanban generico antigo deixa de ser oferecido pela navegacao normal.
5. O registro antigo nao e apagado fisicamente do banco nesta etapa, evitando risco com dependencias antigas.
6. Nenhuma migration foi criada.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. No iPhone, abrir Favoritos e confirmar que a entrada generica `Medida final` com icone de setor desapareceu.
3. Confirmar que existe/acessa a Medicao Final oficial `/producao/medicao-final`.
4. Abrir a tela de Setores e confirmar que a duplicata nao aparece.
5. Confirmar que outros setores genericos continuam funcionando normalmente.
6. Confirmar que desktop/Sidebar nao perderam outros atalhos.

## DEPOIS DESTA VALIDACAO
- Continuar validacao da Medicao Final em campo: parcial, tempo, historico, seis medidas, fotos e SIM/NAO.
- Replicar parcial/campos fixos no link externo se esse for o fluxo principal do medidor.
- Continuar adicionando os proximos campos da Medicao Final na ordem definida pelo usuario.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional deve ser `/producao/medicao-final`.
- Nao apagar fisicamente o registro legado sem antes verificar dependencias no banco.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Credenciais W.Vetro nunca devem ficar no browser.
