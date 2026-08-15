# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar tecnicamente a branch `feat/limpeza-e-fluxo-operacional` e manter tudo agrupado em uma unica PR enquanto o limite diario da Vercel estiver ativo.

## IMPLEMENTADO NA BRANCH ATUAL
1. Navegacao diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia.
2. Sidebar desktop simplificada; setores dinamicos e paginas antigas saem do fluxo principal sem apagar dados/rotas.
3. Favoritos mobile passa a listar apenas as areas essenciais.
4. Master recebe uma secao administrativa separada no desktop e no painel mobile de Favoritos.
5. Topbar deixa de mostrar botoes sem funcao real (`IA Atlas` e notificacoes) e o perfil vira menu funcional.
6. Nova rota `/configuracoes/orcamento`, exclusiva para Master.
7. Padrao do orcamento persistido em `configuracoes_gerais`, sem migration.
8. PDF de Orcamento Balcao aceita titulo, validade, assinatura/aceite e rodape configuraveis.
9. Orcamento Balcao carrega/aplica o padrao salvo ao gerar o PDF.
10. Medicao Final existente foi revisada e continua com a ordem validada; nenhum novo campo foi inventado sem confirmacao do usuario.
11. PR #128 de retry da Vercel foi fechada sem merge para evitar deploy desnecessario.

## VALIDAR ANTES DO MERGE
1. Build Validation verde no GitHub.
2. Desktop: Sidebar deve mostrar apenas as sete areas principais e administracao separada para Master.
3. Mobile: Favoritos deve mostrar apenas as sete areas principais; Master deve conseguir abrir Configuracoes, Padrao do Orcamento e Setores na secao administrativa.
4. Topbar: busca, Novo e perfil/logout devem funcionar; IA Atlas e sino de notificacoes nao devem aparecer.
5. `/configuracoes/orcamento`: salvar e recarregar titulo, validade, opcoes, observacao e rodape.
6. Orcamento Balcao: gerar PDF usando o padrao salvo e confirmar validade/titulo/assinatura/rodape.
7. Confirmar que Medicao Final oficial continua em `/producao/medicao-final`.
8. Confirmar que rotas antigas nao foram apagadas e permanecem acessiveis quando necessario.
9. Nao mergear apenas para testar producao enquanto a Vercel estiver bloqueada por quota diaria.

## BLOQUEIOS REAIS
### Vercel
Plano Hobby atingiu >100 deployments em 24h. Esperar a janela liberar antes do proximo deploy de producao; manter mudancas agrupadas.

### W.Vetro API
A documentacao publica foi localizada, mas os schemas internos nao foram expostos de forma suficiente pelo acesso atual. Para implementar e validar chamadas live sao necessarios:
- credenciais/usuario de integracao de teste;
- ambiente/base URL de teste ou homologacao, se existir;
- schemas/payloads reais dos endpoints que o Postman nao esta expondo ao crawler.

A integracao deve ser server-side, inicialmente somente leitura, e nunca adivinhar campos proprietarios.

## DEPOIS DA VALIDACAO / DESBLOQUEIO
- validar Medicao Final em campo: parcial, tempo, historico, seis medidas, fotos e SIM/NAO;
- validar o PDF profissional com os dados reais da Esquadrifacio;
- iniciar W.Vetro somente leitura por autenticacao -> linhas/produtos/cores/vidros -> orcamentos/pedidos -> producao, conforme schemas reais;
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional deve ser `/producao/medicao-final`.
- Em limpeza, esconder primeiro; excluir codigo/dados somente depois de validar dependencias.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Credenciais W.Vetro nunca devem ficar no browser.
