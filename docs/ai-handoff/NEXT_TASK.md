# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Fechar a ativacao e a arquitetura correta do Plano de Corte depois do merge da PR #129.

A PR #129 ja foi mergeada na `main` e o commit de merge `91d4bd97167342dfb76ca24de53947d12a7a63d0` esta com status Vercel `success`.

## BLOQUEIO OPERACIONAL IMEDIATO — BANCO
A migration `20260815100000_plano_corte_producao_v1.sql` passou no dry-run, mas o workflow nao aplica migration automaticamente no merge.

Para ativar as tabelas em producao e necessario executar manualmente o workflow `Supabase Database Control` com:
- mode: `apply`
- confirmation: `APPLY_PRODUCTION`

Nao declarar o Plano de Corte persistente como validado antes de confirmar esse apply com sucesso.

## REVISAO TECNICA JA FEITA
Foi analisada a Porta de Correr 03 Folhas Moveis | Suprema (`*SUCB-PC3-01EF`) usando relatorios W.Vetro reais da biblioteca do usuario.

Documento: `docs/tecnico/receitas/porta-correr-3f-suprema.md`.

Conclusao importante: largura da folha muda com a configuracao de mao-de-amigo/reforco mesmo quando o vao e igual. Portanto, nao implementar uma formula unica de largura de folha para toda `porta_correr`.

## PROXIMA EVOLUCAO DO SCHEMA DE RECEITAS
A estrutura atual de `engenharia_receitas` permite uma unica receita ativa por `tipologia_id`. Isso e insuficiente para produtos diferentes como porta 2F, 3F, 4F, 5F e linhas distintas.

Evoluir sem quebrar o que existe:
1. permitir receita vinculada a produto cadastrado;
2. manter receita generica por tipologia apenas como fallback;
3. produto deve sugerir/carregar automaticamente sua receita ativa no Plano de Corte;
4. permitir variantes condicionadas pelas variaveis do plano;
5. preservar snapshot do plano sem alterar receita mestre.

## MOTOR DE FORMULAS — ORDEM CORRETA
1. Definir sintaxe oficial e restrita (sem `eval`).
2. Definir variaveis aceitas: largura, altura, quantidade, folgas, folhas e opcoes tecnicas.
3. Suportar condicoes/variantes de perfil de forma declarativa.
4. Validar cada formula contra pelo menos duas amostras reais da mesma configuracao quando a geometria puder variar.
5. Somente depois calcular automaticamente `corte_mm`.
6. Mostrar origem da formula e permitir override somente para Master/edicao.

## PORTA 3F SUPREMA — O QUE JA PODE SER USADO COMO CANDIDATO FORTE
- SU010 = largura - 30;
- TMC = largura - 30;
- SU012 = altura - folga_altura (4 mm nas amostras);
- montantes verticais da folha = altura - 34;
- SU102 vertical = altura - 185;
- vidro altura = altura - 167;
- MP347 face interna observado: horizontal = largura + 44; vertical = altura + 22.

Ainda NAO automatizar largura de folha/vidro ate validar amostras suficientes por variante de mao-de-amigo/reforco.

## DEPOIS DA RECEITA 3F
- cadastrar acessorios e quantidades reais;
- regras de usinagem;
- lista de barras/perfis;
- otimizacao em barras de 6 m;
- reaproveitamento de sobras;
- PDF/romaneio de producao com desenho tecnico validado do perfil;
- vincular plano a obra/Medicao Final/Engenharia liberada.

## VALIDACOES DE CAMPO PARALELAS
- Medicao Final: parcial, tempo, historico, seis medidas, fotos e SIM/NAO;
- Configuracoes -> Orcamento: salvar/recarregar e validar PDF real;
- mobile: navegacao essencial/Favoritos/Voltar/Inicio.

## W.VETRO API
Chamadas live ainda dependem de credenciais/ambiente de teste e schemas reais. Integracao server-side, inicialmente somente leitura, sem adivinhar campos.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional e `/producao/medicao-final`.
- Plano de Corte parte do produto cadastrado e usa receita/variantes validadas.
- Snapshot nunca deve modificar silenciosamente a receita mestre.
- Formula nao validada nao gera medida.
- PDF W.Vetro original deve ser preservado.
- Credenciais W.Vetro nunca ficam no browser.
