# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar e concluir a PR #130 (`fix/pos-merge-plano-corte`), que corrige o handoff da PR #129 e prepara o Plano de Corte para receitas especificas por produto e formulas seguras.

## ESTADO DA PR #130
Implementado:
1. base tecnica real da Porta de Correr 03 Folhas Suprema em `docs/tecnico/receitas/porta-correr-3f-suprema.md`;
2. migration `20260815223000_receitas_por_produto_v1.sql` para `engenharia_receitas.produto_id`;
3. receita generica por tipologia preservada como fallback e receita ativa especifica por produto permitida;
4. `engenhariaReceitas.ts` com busca/criacao de receita por produto mantendo compatibilidade pre-migration;
5. `lib/formulasCorte.ts`, parser aritmetico restrito sem `eval`;
6. migration original do Plano de Corte corrigida para `public.*` + RLS/policy permissiva temporaria;
7. Supabase Database Control ja passou no dry-run das migrations da PR.

Antes do merge, confirmar Build Validation verde no head final da PR.

## BLOQUEIO OPERACIONAL — APPLY DO BANCO
O workflow nao aplica migrations automaticamente no merge.

Para ativar o Plano de Corte persistente e as receitas por produto em producao e necessario executar manualmente `Supabase Database Control` com:
- mode: `apply`
- confirmation: `APPLY_PRODUCTION`

Migrations pendentes relevantes:
- `20260815100000_plano_corte_producao_v1.sql`;
- `20260815223000_receitas_por_produto_v1.sql`.

Nao declarar essas estruturas como ativas no banco sem confirmar o workflow `apply` concluido com sucesso.

## PROXIMA IMPLEMENTACAO APOS PR #130
### 1. Produto -> receita automatica
- ao selecionar produto no Plano de Corte, buscar primeiro receita ativa do `produto_id`;
- se nao existir, oferecer fallback generico da tipologia;
- mostrar claramente qual receita/versao esta sendo usada;
- permitir troca manual somente para Master/edicao.

### 2. Validacao formal de formulas
Adicionar metadados de validacao na receita/componente, por exemplo:
- `formula_validada`;
- `formula_validada_em`;
- `formula_validada_por_id/nome`;
- observacao/evidencia tecnica.

Somente formula marcada como validada pode preencher `corte_mm` automaticamente. Formula nao validada continua apenas como referencia.

### 3. Variantes condicionais
Criar estrutura declarativa para variantes que alteram componentes/geometria, especialmente:
- mao-de-amigo comum/largo;
- reforco interno/externo;
- fechadura;
- roldana 100/200 kg;
- contramarco;
- arremate;
- trilho convencional/embutido;
- numero/montagem das folhas.

Nao colocar condicoes arbitrarias em `eval` nem em scripts salvos no banco.

## PORTA 3F SUPREMA — BASE CANDIDATA FORTE
Amostras reais W.Vetro suportam:
- `SU010 = largura - 30`;
- `TMC = largura - 30`;
- `SU012 = altura - folga_altura` (4 mm nas amostras);
- montantes verticais da folha = `altura - 34`;
- SU102 vertical = `altura - 185`;
- vidro altura = `altura - 167`;
- MP347 face interna observado: horizontal = `largura + 44`; vertical = `altura + 22`.

Ainda NAO automatizar largura da folha/vidro. Mesmo vao 2500 x 2100 gerou 771 mm e 756 mm conforme mao-de-amigo/reforco.

## DEPOIS DA RECEITA 3F
- acessorios e quantidades reais;
- usinagens;
- lista de barras/perfis;
- otimizacao de barras de 6 m;
- reaproveitamento de sobras;
- PDF/romaneio de producao com desenho tecnico validado;
- vinculo direto com obra/Medicao Final/Engenharia liberada.

## VALIDACOES PARALELAS
- Medicao Final: parcial, tempo, historico, seis medidas, fotos e SIM/NAO;
- Configuracoes -> Orcamento: salvar/recarregar e validar PDF real;
- mobile: navegacao essencial/Favoritos/Voltar/Inicio.

## W.VETRO API
Chamadas live ainda dependem de credenciais/ambiente de teste e schemas reais. Integracao server-side, inicialmente somente leitura, sem adivinhar campos.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> Build Validation -> merge.
- A unica Medicao Final operacional e `/producao/medicao-final`.
- Plano de Corte parte do produto cadastrado.
- Receita especifica do produto tem prioridade; generica da tipologia e fallback.
- Snapshot nunca modifica silenciosamente a receita mestre.
- Formula nao validada nao gera medida.
- PDF W.Vetro original deve ser preservado.
- Credenciais W.Vetro nunca ficam no browser.


## ATUALIZACAO -- W.Vetro extracao historica concluida -- 2026-08-16
Diferente do que este arquivo dizia antes ("credenciais/ambiente de teste ainda sao prerequisitos"): o usuario forneceu credenciais reais da API W.Vetro no chat e uma extracao pontual (nao recorrente) foi feita:
- 109 tipologias novas inseridas em `tipologias` (total 120), a partir de Linha+Modelo reais de 1038 vendas/orcamentos;
- 871 produtos inseridos em `produtos` (479 perfil + 392 acessorio) com `preco = 0` (placeholder);
- mapeamento completo da API em `docs/ai-handoff/WVETRO_API_MAPPING.md`;
- detalhes/limitacoes em IMPLEMENTATIONS.md, secao "W.Vetro -- extracao historica inicial".

Isto NAO substitui nem conflita com o trabalho de integracao live/server-side descrito acima (PR #130 e receitas por produto) -- sao objetivos diferentes. O aviso "Credenciais W.Vetro nunca ficam no browser" (secao CUIDADOS) permanece valido como norma para integracao PERMANENTE; a extracao pontual feita aqui usou o browser por necessidade tecnica (sandbox sem rede ate api.wvetro.com.br) e a aba/token foram descartados ao final.

Pendente agora: revisar/precificar o catalogo de produtos importado (esta com preco 0) antes de usar em orcamento real.
