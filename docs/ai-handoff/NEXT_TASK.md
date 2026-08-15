# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/mobile-voltar-inicio`.

A `main` ja possui a PR #123, que removeu visualmente a barra inferior extensa do celular e deixou Favoritos como acesso rapido principal.

O usuario identificou que, ao entrar em telas internas no iPhone, faltava uma saida clara. Pediu um botao para voltar e outro para retornar ao Inicio.

## IMPLEMENTADO NA BRANCH ATUAL
1. Novo `MobileNavigationControls` aparece somente no mobile.
2. Fora da Home mostra dois botoes compactos no canto inferior esquerdo: `Voltar` e `Inicio`.
3. `Voltar` chama o historico do navegador.
4. Se nao houver historico util, `Voltar` cai na Home.
5. `Inicio` sempre navega para `/`.
6. Na Home fica apenas `Inicio`, sem botao Voltar desnecessario.
7. Favoritos da PR #123 continua no canto inferior direito.
8. Desktop permanece igual.
9. Nao exige migration.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir no iPhone uma tela interna como Kanban/Tarefas/Medicao Final.
3. Confirmar que `Voltar` e `Inicio` aparecem no canto inferior esquerdo.
4. Tocar `Voltar` e confirmar retorno para a tela anterior.
5. Abrir a tela novamente e tocar `Inicio`; confirmar abertura da Home.
6. Na Home confirmar que nao aparece um `Voltar` inutil.
7. Confirmar que o botao Favoritos continua no canto inferior direito.
8. Confirmar que os controles nao cobrem botoes importantes, campos de Medicao Final ou rodape de telas longas.
9. Abrir no desktop e confirmar que nada mudou na Sidebar/topbar.

## DEPOIS DESTA VALIDACAO
- Ajustar tamanho/posicao de Voltar, Inicio ou Favoritos se o teste real no iPhone pedir.
- Continuar validacao da PR #122 em campo: parcial, tempo e historico.
- Replicar parcial/campos fixos no link externo se esse for o fluxo principal do medidor.
- Continuar adicionando os proximos campos de Medicao Final na ordem definida pelo usuario.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- Navegacao mobile nao pode remover rotas nem alterar desktop.
- `Voltar` nao deve prender o usuario fora do sistema; manter fallback para Inicio.
- Favoritos devem continuar respeitando permissoes do usuario.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Credenciais W.Vetro nunca devem ficar no browser.
