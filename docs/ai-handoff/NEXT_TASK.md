# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/home-mais-limpa` no iPhone.

O usuario pediu simplificar a Home e retirar atalhos redundantes ou sem uso.

## IMPLEMENTADO NA BRANCH ATUAL
1. Remove o botao `Medições finais` do bloco principal escuro da Home.
2. Remove o link `Abrir operação` do mesmo bloco.
3. Mantem apenas `Novo orçamento` como acao principal do hero.
4. Favoritos continua sendo o acesso rapido para Medicao Final e demais areas escolhidas.
5. Na propria Home, o botao flutuante `Inicio` nao aparece mais.
6. Fora da Home, `Voltar` e `Inicio` continuam disponiveis.
7. Nenhuma rota ou funcionalidade foi apagada; e uma limpeza de navegacao/visual.
8. Nenhuma migration.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir a Home no iPhone e confirmar que o bloco escuro mostra somente `Novo orçamento`.
3. Confirmar que `Medições finais` e `Abrir operação` nao aparecem mais nesse bloco.
4. Confirmar que o botao flutuante `Inicio` nao aparece na Home.
5. Abrir uma tela interna e confirmar que `Voltar` e `Inicio` continuam aparecendo.
6. Confirmar que Favoritos continua abrindo e que a Medicao Final oficial permanece acessivel por ele.

## DEPOIS DESTA VALIDACAO
- Fazer uma segunda limpeza orientada por uso real: listar paginas/setores que nao sao usados antes de remover qualquer rota ou dado.
- Continuar validacao da Medicao Final em campo: parcial, tempo, historico, seis medidas, fotos e SIM/NAO.
- Continuar adicionando os proximos campos da Medicao Final.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional deve ser `/producao/medicao-final`.
- Antes de remover outras paginas/setores, confirmar uso e dependencias; esconder primeiro quando houver duvida.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
