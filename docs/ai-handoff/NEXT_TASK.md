# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Concluir e mergear a PR #131 depois do Build Validation final verde.

A PR #131 implementa:
- produto -> receita especifica automatica no Plano de Corte;
- fallback generico por tipologia;
- tela `/engenharia/receitas-produtos`;
- validacao auditavel de formulas;
- calculo automatico de `corte_mm` somente para formula validada;
- snapshot continua editavel e independente da receita mestre.

## BLOQUEIO OPERACIONAL — BANCO
As migrations passam em dry-run, mas nao sao aplicadas automaticamente.

Para ativar em producao e necessario executar manualmente `Supabase Database Control` com:
- `mode = apply`
- `confirmation = APPLY_PRODUCTION`

Migrations pendentes:
1. `20260815100000_plano_corte_producao_v1.sql`
2. `20260815223000_receitas_por_produto_v1.sql`
3. `20260815224500_validacao_formulas_receitas_v1.sql`

Somente depois de workflow `apply` concluido com sucesso considerar o Plano de Corte persistente/receitas por produto/formulas validadas ativos no banco.

## PROXIMA IMPLEMENTACAO DEPOIS DO APPLY
### Variantes condicionais declarativas
Criar estrutura propria, sem `eval`, para determinar componentes/formulas conforme variaveis do produto/plano:
- mao-de-amigo comum ou largo;
- reforco interno/externo;
- fechadura;
- roldana 100 kg / 200 kg;
- contramarco;
- arremate;
- trilho convencional / embutido;
- quantidade e montagem das folhas;
- linha tecnica.

A variante deve ser visivel e auditavel na receita e no snapshot.

## RECEITA PRIORITARIA PARA VALIDACAO
Porta de Correr 03 Folhas Moveis | Suprema (`*SUCB-PC3-01EF`).

Candidatas fortes ja documentadas:
- `SU010 = largura - 30`
- `TMC = largura - 30`
- `SU012 = altura - folga_altura`
- montantes verticais = `altura - 34`
- SU102 vertical = `altura - 185`
- vidro altura = `altura - 167`
- MP347 face interna observado: horizontal `largura + 44`; vertical `altura + 22`

Ainda NAO validar formula unica da largura da folha/vidro. A mesma medida 2500 x 2100 produziu larguras diferentes conforme mao-de-amigo/reforco.

## DEPOIS DAS VARIANTES
- cadastrar acessorios e quantidades reais;
- cadastrar usinagens;
- gerar lista de barras/perfis;
- otimizar barras de 6 m;
- controlar reaproveitamento de sobras;
- gerar PDF/romaneio de producao com desenho tecnico validado;
- vincular plano diretamente a obra/Medicao Final/Engenharia liberada.

## VALIDACOES PARALELAS
- Medicao Final: parcial, tempo, historico, medidas, fotos e SIM/NAO;
- Configuracoes -> Orcamento: PDF real;
- mobile: navegacao/Favoritos/Voltar/Inicio.

## W.VETRO
Integracao live continua bloqueada por credenciais/schemas reais. Quando disponivel: server-side e inicialmente somente leitura.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Branch -> PR -> Build Validation -> merge.
- Formula nao validada nao gera corte.
- Receita especifica do produto tem prioridade; tipologia e fallback.
- Snapshot nao altera receita mestre.
- Nunca inventar dimensao.
- Nunca usar `eval` para formulas/variantes.
