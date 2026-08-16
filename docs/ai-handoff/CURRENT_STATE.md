# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-15.

## MAIN
`main` esta no merge da PR #130, commit `c1121cdc047997c7e420e52f4f822e6de673bb6d`, com status Vercel `success`.

Mergeado e disponivel no codigo principal:
- navegacao essencial e Home limpa;
- Medicao Final oficial em `/producao/medicao-final`;
- medicao parcial, cronometro, historico e FEITA/EM ABERTO;
- Configuracoes -> Orcamento e PDF configuravel;
- Producao com etapa Plano de Corte em `/producao/plano-corte`;
- base de receitas tecnicas da Engenharia;
- receitas orientadas a produto no schema da PR #130;
- parser seguro de formulas em `lib/formulasCorte.ts`, sem `eval`/`new Function`;
- base tecnica real da Porta de Correr 03 Folhas Suprema em `docs/tecnico/receitas/porta-correr-3f-suprema.md`.

## BRANCH ATUAL / PR #131
Branch: `feat/plano-corte-receita-automatica`.
Objetivo: produto -> receita especifica automatica -> formula tecnicamente validada -> snapshot editavel.

Implementado:
- ao selecionar um produto no Plano de Corte, o Atlas busca primeiro a receita ativa do `produto_id`;
- se nao existir receita especifica, permite escolher receita generica da tipologia como fallback;
- mostra nome, versao e origem da receita usada;
- nova pagina `/engenharia/receitas-produtos` para criar/manter receita mestre especifica por produto;
- permissao da pagina segue Engenharia: Master/edicao altera e valida; consulta apenas visualiza; oculto bloqueia;
- nova migration `20260815224500_validacao_formulas_receitas_v1.sql` adiciona validacao auditavel de formulas;
- formula editada perde validacao e precisa ser validada novamente;
- validacao exige evidencia tecnica registrada e grava usuario/data;
- `criarPlanoCorte` calcula `corte_mm` somente quando `formula_corte_validada=true`, dimensoes sao positivas e o parser seguro consegue avaliar a formula;
- formula nao validada nunca gera corte automatico;
- snapshot copia os flags de validacao e continua editavel sem alterar a receita mestre.

CI da PR #131:
- Supabase Database Control: dry-run aprovado;
- Vercel Preview: Ready;
- Build Validation deve permanecer verde no head final antes do merge.

## BANCO — PENDENTE DE APPLY MANUAL
O workflow `Supabase Database Control` NAO aplica migrations automaticamente no merge. O apply exige `workflow_dispatch` manual com:
- mode: `apply`
- confirmation: `APPLY_PRODUCTION`

Migrations relevantes ainda devem ser consideradas pendentes em producao ate existir um workflow `apply` concluido com sucesso:
- `20260815100000_plano_corte_producao_v1.sql`;
- `20260815223000_receitas_por_produto_v1.sql`;
- `20260815224500_validacao_formulas_receitas_v1.sql`.

## PORTA DE CORRER 03 FOLHAS SUPREMA — BASE TECNICA
Amostras reais W.Vetro suportam como candidatas fortes:
- SU010 = largura - 30;
- TMC = largura - 30;
- SU012 = altura - folga_altura (4 mm nas amostras);
- montantes verticais da folha = altura - 34;
- SU102 vertical = altura - 185;
- vidro altura = altura - 167;
- MP347 face interna observado: horizontal = largura + 44; vertical = altura + 22.

NAO automatizar ainda a largura da folha/vidro: o mesmo vao 2500 x 2100 gerou 771 mm e 756 mm conforme a configuracao de mao-de-amigo/reforco.

## DECISAO PERMANENTE DO PLANO DE CORTE
Plano de Corte = **produto cadastrado + receita mestre + variaveis + snapshot editavel**.
- receita especifica do produto tem prioridade;
- receita generica da tipologia e fallback;
- variaveis/variantes escolhem componentes e formulas;
- snapshot nunca altera silenciosamente a receita mestre;
- formula nao validada nao gera medida;
- override do plano depende de permissao de edicao.

## MEDICAO FINAL — ORDEM POR PECA
1. identificacao;
2. foto trena largura/altura;
3. Largura Baixo/Meio/Cima;
4. Altura Direita/Meio/Esquerda;
5. Contramarco/Arremate/Cadeirinha/Cantoneira SIM/NAO;
6. observacao;
7. demais campos configuraveis;
8. fotos adicionais.

## AINDA PENDENTE
- aplicar migrations do Plano de Corte no banco de producao;
- validar Plano de Corte e Receitas por Produto com banco ativo;
- criar modelo declarativo de variantes condicionais (mao-de-amigo, reforcos, fechadura, roldana, contramarco, arremate, trilho, folhas);
- completar receita 3F Suprema com acessorios e usinagens;
- lista de barras, otimizacao de 6 m, sobras e romaneio/PDF com desenho tecnico;
- validar Medicao Final em campo e PDF de Orcamento com dados reais;
- W.Vetro API live somente depois de credenciais/schemas reais.

## SEGURANCA
- GitHub e a unica fonte da verdade;
- nunca commitar direto na main;
- formulas do banco nunca usam `eval`;
- medidas ausentes nunca sao inventadas;
- PDF W.Vetro original deve ser preservado;
- nao usar `migration repair --reverted` sem diagnostico explicito.
