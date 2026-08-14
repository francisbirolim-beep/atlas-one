# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a PR #120 / branch `feat/medicao-padrao-sim-nao-observacao`.

A PR #119 ja esta em `main` e adicionou em toda peça da Medicao Final as 3 larguras, 3 alturas e duas fotos da trena.

O usuario pediu agora que toda peça tenha tambem um bloco padrao fixo com:
- CONTRAMARCO — SIM / NAO;
- ARREMATE — SIM / NAO;
- CADEIRINHA — SIM / NAO;
- CANTONEIRA — SIM / NAO;
- OBSERVACAO no final.

Tambem pediu um lembrete claro ao iniciar a medicao: **sempre fazer a medição pela vista interna do vão**.

## IMPLEMENTADO NA PR #120
1. Novo `MedicaoPadroesFixosPanel` exibido na tela interna de toda Medicao Final.
2. Selecoes SIM/NAO salvam imediatamente por peça.
3. Dados sao guardados em `medicao_itens.campos_extras` sem apagar outras chaves existentes.
4. Chaves fixas: `padrao_contramarco`, `padrao_arremate`, `padrao_cadeirinha`, `padrao_cantoneira`.
5. Campo `observacao_medicao` sempre aparece no final da peça e possui salvamento proprio.
6. Banner permanente lembra a regra da vista interna.
7. Se a medicao estiver `liberado` e ainda nao tiver `iniciado_em`, um modal aparece reforcando a vista interna antes do inicio.
8. As seis medidas finais, fotos da trena e checklist configuravel permanecem independentes e inalterados.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde no head final.
2. Abrir uma Medicao Final real com varias peças.
3. Confirmar que o novo bloco aparece para cada peça.
4. Em uma peça, marcar SIM/NAO nos quatro itens.
5. Trocar para outra peça e voltar; confirmar que as escolhas persistiram corretamente e nao vazaram entre peças.
6. Recarregar a pagina; confirmar persistencia.
7. Digitar uma observacao, salvar, trocar de peça e voltar; confirmar persistencia.
8. Alterar uma resposta de SIM para NAO e confirmar atualizacao correta.
9. Confirmar que os demais `campos_extras` configuraveis da peça nao foram apagados.
10. Com medicao ainda `aguardando_liberacao`, confirmar que o modal nao aparece.
11. Liberar a medicao; confirmar que aparece o aviso `Sempre medir pela vista interna do vão` antes do inicio.
12. Fechar/confirmar o aviso e iniciar a medicao normalmente.
13. Confirmar que o banner de vista interna continua visivel no bloco padrao.
14. Fazer regressao das seis medidas finais e fotos da trena da PR #119.

## DEPOIS DESTA VALIDACAO
1. Se o medidor usar principalmente o link externo, levar CONTRAMARCO/ARREMATE/CADEIRINHA/CANTONEIRA, observacao e aviso de vista interna tambem para `/medicao-final/acesso/[token]`.
2. Continuar teste de campo completo do PDF `FELIPE ALVES SANTANA-861.pdf`.
3. Avaliar leitura automatica por IA das fotos da trena diretamente na Medicao Final V2.
4. Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
5. Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste e responses reais.
6. Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- Os quatro campos SIM/NAO e a observacao sao por peça, nao globais da obra.
- Sempre preservar chaves existentes em `campos_extras` ao salvar os novos campos.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Medida comum/referencia W.Vetro nunca deve preencher automaticamente as seis medidas finais.
- Credenciais W.Vetro nunca devem ficar no browser.
