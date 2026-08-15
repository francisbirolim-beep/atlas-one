# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar tecnicamente a branch `feat/limpeza-e-fluxo-operacional` e manter tudo agrupado na PR #129 enquanto o limite diario da Vercel estiver ativo.

## IMPLEMENTADO NA BRANCH ATUAL
1. Navegacao diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia.
2. Sidebar desktop/Favoritos mobile simplificados e administracao separada para Master.
3. Topbar limpa e perfil/logout funcional.
4. Nova rota `/configuracoes/orcamento` e padrao configuravel do PDF de Orcamento Balcao.
5. Nova etapa `/producao/plano-corte` ligada ao setor Producao junto da Medicao Final.
6. Plano de Corte pesquisa produto cadastrado, escolhe receita tecnica, cria snapshot persistente e editavel e permite ajustar variaveis, perfis, acessorios, quantidades e corte final.
7. Permissoes do Plano de Corte seguem o setor Producao: Master/edicao alteram; consulta visualiza; oculto bloqueia.
8. Migration `20260815100000_plano_corte_producao_v1.sql` cria `planos_corte` e `plano_corte_componentes`.
9. Formula nao validada nunca gera medida inventada; fica visivel como referencia e o corte final permanece para conferencia/ajuste.

## VALIDAR ANTES DO MERGE
1. Build Validation verde no GitHub.
2. Desktop/mobile: navegacao essencial e administracao separada.
3. `/configuracoes/orcamento`: salvar/recarregar e gerar PDF com o padrao.
4. Producao deve mostrar as etapas `Medicao Final` e `Plano de Corte`.
5. Plano de Corte: pesquisar um produto `porta_janela_padrao`, selecionar receita, gerar snapshot e reabrir em Planos recentes.
6. Confirmar que usuario com `consulta` em Producao nao consegue editar; `edicao` consegue; `oculto` nao acessa.
7. Trocar um perfil/acessorio do snapshot e confirmar que a receita tecnica original nao e alterada.
8. Confirmar que Medicao Final oficial continua em `/producao/medicao-final`.
9. Nao mergear apenas para testar producao enquanto a Vercel estiver bloqueada por quota diaria.

## PROXIMA EVOLUCAO DO PLANO DE CORTE
- cadastrar/validar receitas reais por tipologia, comecando por Porta de Correr 3 Folhas;
- definir sintaxe oficial das formulas de quantidade/corte e variaveis aceitas;
- so depois ativar calculo automatico dos comprimentos;
- adicionar lista de barras/perfis, otimizacao de barras e aproveitamento de sobras;
- gerar PDF/romaneio de producao com desenho tecnico do perfil quando houver imagem validada;
- vincular futuramente o plano diretamente a obra/Medicao Final/Engenharia liberada.

## BLOQUEIOS REAIS
### Vercel
Plano Hobby atingiu >100 deployments em 24h. Esperar a janela liberar antes do proximo deploy de producao; manter mudancas agrupadas.

### W.Vetro API
Para chamadas live ainda faltam credenciais/ambiente de teste e schemas reais. Integracao deve ser server-side, inicialmente somente leitura e sem adivinhar campos.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional deve ser `/producao/medicao-final`.
- Plano de Corte deve derivar de produto/receita cadastrados, sem inventar perfis, acessorios ou formulas.
- Alteracoes do plano sao snapshot da producao e nao devem modificar silenciosamente a receita mestre.
- PDF W.Vetro original deve ser preservado.
- Credenciais W.Vetro nunca devem ficar no browser.
