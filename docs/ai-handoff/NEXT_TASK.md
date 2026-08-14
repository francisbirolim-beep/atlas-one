# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `feat/medicao-parcial-historico-tempo`.

A `main` ja possui a PR #121 com o fluxo da peça na ordem:
medidas/fotos da trena -> SIM/NAO -> observacao -> demais campos -> fotos adicionais.

O usuario pediu agora controle real de visita parcial:
- depois de iniciar, registrar data/hora e contar o tempo;
- permitir medir apenas parte das pecas e salvar como Medicao Parcial;
- marcar visualmente as feitas com check e manter as demais em aberto;
- preservar tudo para uma segunda visita;
- ao liberar o restante, retomar a mesma medicao;
- manter historico de quando iniciou, quando ficou parcial e quando retomou.

## IMPLEMENTADO NA BRANCH ATUAL
1. `MedicaoParcialPanel` aparece quando existe `iniciado_em`.
2. Cronometro conta somente tempo ativo.
3. `Salvar medição parcial` registra snapshot e pausa o cronometro.
4. `Retomar medição` registra nova entrada de historico e volta a contar.
5. Pecas com `medido=true` aparecem como `✅ FEITA`; as outras como `EM ABERTO`.
6. Medidas, fotos, checklist e observacoes ja salvos nao sao alterados ao pausar/retomar.
7. Historico usa `medicao_revisoes` ja existente, com motivo `Medição parcial` / `Retomada da medição`, data/hora, usuario e contagem feita/em aberto.
8. O inicio e sintetizado a partir de `medicoes_finais.iniciado_em`.
9. Nao ha migration nova nesta etapa.
10. Para compatibilidade com telas antigas, `status_operacional` nao ganhou novo valor; o estado parcial e derivado do ultimo evento do historico.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir uma Medicao Final ainda nao iniciada e confirmar que o painel parcial nao aparece.
3. Iniciar a medicao; confirmar que o painel aparece e o cronometro comeca.
4. Medir 2 ou 3 pecas e salvar as seis medidas de cada uma.
5. Confirmar que essas pecas aparecem com `✅ FEITA` e as demais com `EM ABERTO`.
6. Clicar `Salvar medição parcial`.
7. Confirmar banner de parcial e cronometro pausado.
8. Recarregar a pagina; confirmar que estado parcial, pecas feitas e historico continuam iguais.
9. Abrir `Histórico`; confirmar data/hora do inicio e da parcial, usuario e quantidade feita/em aberto.
10. Clicar `Retomar medição`; confirmar nova entrada no historico e cronometro voltando a contar.
11. Medir o restante; confirmar que os checks antigos permanecem e novos checks aparecem.
12. Salvar parcial uma segunda vez e confirmar novo ciclo no historico.
13. Retomar e concluir 100% da medicao normalmente.
14. Fazer regressao dos campos SIM/NAO, observacao, fotos da trena e aviso de vista interna.

## DEPOIS DESTA VALIDACAO
- Se desejado, transformar Medicao Parcial em status operacional dedicado e refletir esse status tambem no quadro principal.
- Replicar o mesmo controle no link externo `/medicao-final/acesso/[token]` se esse for o fluxo principal do medidor.
- Avaliar leitura por IA das fotos da trena diretamente na Medicao Final V2.
- Continuar adicionando os proximos campos de medicao na mesma sequencia solicitada pelo usuario.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- Salvar como parcial nunca pode apagar ou zerar pecas ja medidas.
- Retomar deve continuar a mesma `medicao_id`; nunca recriar a Medicao Final.
- O tempo parcial deve excluir intervalos entre pausa e retomada.
- O historico deve ser append-only: novas pausas/retomadas criam novas revisoes.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Credenciais W.Vetro nunca devem ficar no browser.
