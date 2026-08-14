# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/medicao-ordem-padroes-abaixo-medidas`.

A PR #120 ja esta em `main` e adicionou por peça:
- CONTRAMARCO — SIM / NAO;
- ARREMATE — SIM / NAO;
- CADEIRINHA — SIM / NAO;
- CANTONEIRA — SIM / NAO;
- OBSERVACAO;
- lembrete para medir pela vista interna do vao.

O teste no celular mostrou que esse bloco ficou como painel separado depois das fotos. O usuario pediu uma ordem unica e sequencial dentro da mesma peca.

## IMPLEMENTADO NA BRANCH ATUAL
1. `MedicaoPadroesFixosPanel` agora recebe diretamente o `itemId` selecionado no `MedicaoChecklistV2Panel`.
2. A barra duplicada `Peca 1 / Peca 2 / ...` foi removida desse bloco.
3. O bloco fica imediatamente depois das seis medidas e fotos da trena.
4. A observacao fica imediatamente depois de CONTRAMARCO / ARREMATE / CADEIRINHA / CANTONEIRA.
5. Depois entram os campos configuraveis por tipologia e, por ultimo, fotos adicionais da peça.
6. O painel separado foi removido do `AppShell`.
7. O aviso antes do inicio foi preservado em `MedicaoVistaInternaAviso`, independente da posicao do bloco.

## ORDEM ESPERADA NA TELA DE CADA PECA
1. identificacao da peça;
2. foto da trena LARGURA;
3. foto da trena ALTURA;
4. Largura Baixo / Meio / Cima;
5. Altura Direita / Meio / Esquerda;
6. Contramarco SIM/NAO;
7. Arremate SIM/NAO;
8. Cadeirinha SIM/NAO;
9. Cantoneira SIM/NAO;
10. Observacao da peça;
11. demais informacoes/checklists configurados;
12. fotos adicionais.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde.
2. Abrir no celular a mesma Medicao Final usada no print.
3. Confirmar que nao existe mais um painel separado `Padroes da medicao` depois das fotos.
4. Na Peça 1, rolar logo abaixo das medidas e confirmar a tabela SIM/NAO.
5. Confirmar que a observacao vem logo abaixo da tabela.
6. Trocar para Peça 2 e confirmar que tabela/observacao acompanham a peca selecionada.
7. Marcar respostas diferentes entre Peça 1 e Peça 2; voltar e confirmar persistencia individual.
8. Confirmar que campos configuraveis aparecem depois da observacao.
9. Confirmar que fotos adicionais continuam no final.
10. Em medicao `liberado` sem `iniciado_em`, confirmar o aviso `Sempre fazer a medição pela vista interna do vão`.
11. Fazer regressao das seis medidas e fotos da trena da PR #119.

## DEPOIS DESTA VALIDACAO
- Continuar adicionando os proximos campos da Medicao Final na mesma sequencia, conforme o usuario enviar.
- Se o link externo for a interface principal do medidor, replicar a mesma ordem e os campos fixos em `/medicao-final/acesso/[token]`.
- Continuar teste completo do PDF `FELIPE ALVES SANTANA-861.pdf`.
- Avaliar leitura por IA das fotos da trena diretamente na Medicao Final V2.
- Criar `Configurações -> Orçamento` e melhorar o PDF Atlas profissional.
- Iniciar conector W.Vetro API somente leitura quando houver credencial/ambiente de teste.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- Os quatro campos SIM/NAO e a observacao sao por peça, nao globais da obra.
- Preservar chaves existentes em `campos_extras`.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Medida comum/referencia W.Vetro nunca deve preencher automaticamente as seis medidas finais.
- Credenciais W.Vetro nunca devem ficar no browser.
