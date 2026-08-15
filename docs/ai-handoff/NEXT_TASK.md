# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `feat/mobile-favoritos`.

A `main` ja possui a PR #122 com Medicao Parcial, cronometro ativo, historico de pausa/retomada e pecas `✅ FEITA` / `EM ABERTO`.

O usuario pediu agora retirar a barra fixa inferior do celular, que estava cheia de icones/labels cortados, mas manter um local simples para Favoritos.

## IMPLEMENTADO NA BRANCH ATUAL
1. A barra/nav antiga do `Sidebar` fica oculta somente no mobile; desktop permanece igual.
2. Novo botao compacto `Favoritos` fica fixo no canto inferior do celular.
3. Ao tocar, abre uma folha inferior com os favoritos atuais.
4. A mesma folha permite marcar/desmarcar Paginas com estrela.
5. Tambem permite marcar/desmarcar Setores visiveis ao usuario.
6. Reaproveita as preferencias existentes de `lib/guias.ts` e `lib/favoritosSetores.ts`, portanto os antigos atalhos favoritos nao sao descartados.
7. Permissoes dos Setores continuam sendo aplicadas.
8. Na Inicio existe um bloco `Acesso rápido / Favoritos` com ate 5 atalhos; se houver mais, mostra acesso para os demais.
9. Nao remove nenhuma rota do sistema e nao exige migration.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir a Inicio no iPhone e confirmar que a barra inferior antiga nao aparece.
3. Confirmar que o botao `Favoritos` aparece no canto inferior sem cobrir conteudo importante.
4. Tocar no botao e confirmar que a folha abre e fecha corretamente.
5. Confirmar que favoritos que ja existiam aparecem em `Abrir favorito`.
6. Marcar uma Pagina nova com estrela, fechar e reabrir; confirmar que ela aparece nos favoritos.
7. Desmarcar a mesma Pagina e confirmar que sai dos favoritos.
8. Repetir com um Setor, especialmente `Medida Final` se estiver disponivel para o usuario.
9. Recarregar a pagina e confirmar persistencia dos favoritos.
10. Na Inicio, confirmar o bloco `Acesso rápido / Favoritos` e os atalhos funcionando.
11. Abrir no desktop e confirmar que a Sidebar continua exatamente disponivel, sem regressao.
12. Conferir uma tela longa de Medicao Final para garantir que o botao flutuante nao bloqueia salvar/continuar.

## DEPOIS DESTA VALIDACAO
- Ajustar tamanho/posicao do botao Favoritos se o teste real no iPhone pedir.
- Se desejado, sincronizar favoritos no banco por usuario em vez de somente localStorage por navegador.
- Continuar validacao da PR #122 em campo: parcial, tempo e historico.
- Replicar parcial/campos fixos no link externo se esse for o fluxo principal do medidor.
- Continuar adicionando os proximos campos de Medicao Final na ordem definida pelo usuario.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- Remover visualmente a barra mobile nao pode remover rotas/acessos do desktop.
- Favoritos devem respeitar permissoes do usuario.
- Nao apagar preferencias ja existentes ao migrar da barra antiga para o novo painel.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Credenciais W.Vetro nunca devem ficar no browser.
