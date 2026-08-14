# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

## Medicao Final V2 — PRs #54 a #56
- #54: responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios.
- #55: checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas.
- #56: link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao interna.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da cota da Vercel.

## Redesign profissional — PRs #57 a #63
- Home executiva, Sidebar, Kanban Comercial, Central/Pesquisa de Orcamentos, Medicao Final, Producao e base profissional para setores.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
- entrada automatica da Medicao Final aprovada na Engenharia;
- rota dedicada `/engenharia` e fluxo operacional;
- conferencia tecnica persistente por peca;
- bloqueio de liberacao incompleta;
- liberacao transacional/idempotente Engenharia -> Producao.

## Kanban — fotos e trena — PRs #104 a #108 — 2026-08-13
- restaura `Iniciar orçamento`, preserva fotos, cria galeria por esquadria, identifica LARGURA/ALTURA e adiciona leitura por IA;
- #108 corrige a inversao Baixo/Cima da LARGURA observada em teste real.

## Kanban — W.Vetro, total e moeda — PRs #109 a #111 — 2026-08-13
- anexo original W.Vetro padronizado;
- leitura automatica do total do PDF;
- moeda BRL correta e envio/reenvio individual de anexos.

## Medicao Final — importar orçamento W.Vetro — PR #112 — 2026-08-14
- `Nova medição` recebe PDF W.Vetro, mostra preview e cria Medicao Final;
- parser dedicado `lib/wvetroPdf.ts`;
- PDF original preservado;
- medidas do orçamento entram somente como referencia;
- bloqueio de duplicidade por numero W.Vetro;
- merge `56910395fd9f80e08ea8edf170cda45a3b0736c4`.

## Medicao Final — W.Vetro sem medidas no PDF — PR #113 — 2026-08-14
- `FELIPE ALVES SANTANA-861.pdf` possui 7 esquadrias mas nao imprime largura/altura;
- itens identificaveis deixam de ser descartados apenas pela falta de dimensoes;
- nenhuma medida final e inventada;
- merge `44ce91c5281ec0686ed8db3d1732634cc722498a`.

## Medicao Final — identificacao, telefone e dados manuais da empresa — PR #114 — 2026-08-14
- faixa Cliente/Obra/Orçamento;
- numero externo W.Vetro tem prioridade;
- nome da obra pode ser lido do PDF original;
- telefone do responsavel usa WhatsApp cadastrado com fallback manual;
- dados da empresa legados/seedados deixam de ser tratados como configuracao manual;
- merge `5af697bc154720435b1281c05034888e7a84fba0`.

## Medicao Final — corrigir Cliente/Cidade no preview W.Vetro — PR #115 — 2026-08-14
- primeira correcao do parser do cabecalho do PDF 861;
- cidade deixa de incluir trecho do CEP;
- merge `20aaa50845bf0a37da44db2394a155571669093a`.

## Medicao Final — reaproveitar apoio W.Vetro antigo — PR #116 — 2026-08-14
- permite reparar/reaproveitar orçamento interno sem Medicao Final;
- duplicidade continua bloqueada quando ja existe Medicao Final;
- PDF original preservado e reutilizado;
- merge `09514a5feb16a89d333e343732c3bcf873cba4c4`.

## Medicao Final — ocultar apoios W.Vetro do seletor Atlas — PR #117 — 2026-08-14
- registros `Importado do W.Vetro | ...` deixam de aparecer em `OU USAR ORÇAMENTO DO ATLAS`;
- apoio continua preservado no banco;
- orcamentos comerciais reais continuam elegiveis;
- merge `7a16d4161174ab4ddd78151da9d99b6946364c14`.

## Medicao Final — rejeitar rotulos concatenados como cliente — PR #118 — 2026-08-14
- `pdf-parse` podia fundir `CLIENTE`, `CELULAR` e `TEL. FIXO` em textos como `CELULARTEL. FIXO:`;
- parser passa a identificar combinacoes de rotulos concatenados e rejeita-las como nome;
- preserva nomes reais parecidos, como `TELMA`;
- teste real confirmou `FELIPE ALVES SANTANA`, `JOSE BONIFACIO - SP`, 7 itens;
- merge `08a44d9d24730074a36191558266f03efcb0f626`.

## Medicao Final — medidas fixas e fotos da trena — PR #119 — 2026-08-14
- adiciona bloco fixo `Medidas finais da peça` no `MedicaoChecklistV2Panel`;
- toda peça mostra sempre 3 larguras: baixo, meio e cima;
- toda peça mostra sempre 3 alturas: direita, meio e esquerda;
- adiciona foto da trena da LARGURA e foto da trena da ALTURA com upload/troca;
- medidas principais ficam independentes do checklist configuravel por tipologia;
- `medido=true` somente quando as seis medidas possuem valores positivos;
- cards de peça mostram `Medidas completas` ou `Medidas pendentes`;
- orçamento Atlas com `tipo_medida=final` pode fornecer automaticamente as seis medidas e fotos que ja existirem;
- heranca nunca usa medida comum/referencia, nunca inventa valor ausente e nao sobrescreve dado ja salvo;
- pareamento automatico de heranca e bloqueado quando a quantidade de linhas diverge do orçamento, evitando associacao errada apos separacao de peças;
- branch `feat/medicao-final-medidas-fixas`, em validacao.

## W.Vetro API — levantamento de integracao — 2026-08-14
- endpoints mapeados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes;
- futura integracao deve ser server-side e Atlas continua sendo fonte da verdade;
- preferir API/JSON estruturado quando autenticada e validada, mantendo PDF como fallback/documento original;
- ainda nao foi confirmado acesso API a receitas/BOM, formulas, usinagens, lista/plano de corte ou otimizacao.

## Pontos funcionais ainda pendentes
- Validar visualmente a PR #119 em uma Medicao Final real.
- Confirmar que PDF W.Vetro 861 continua criando 7 peças com as seis medidas vazias.
- Validar heranca usando um orçamento Atlas realmente marcado como `tipo_medida=final`, com 3 larguras, 3 alturas e fotos da trena ja preenchidas.
- Validar upload/troca das duas fotos da trena na Medicao Final.
- Validar que uma peça só entra como medida quando as seis medidas estão preenchidas.
- Validar faixa Cliente/Obra/Orçamento e telefone automatico do responsavel.
- Confirmar que Dados da Empresa fica vazio ate configuracao manual.
- Fazer regressao com `FRANCIS TESTE-977.pdf`.
- Criar `Configurações -> Orçamento` e PDF Atlas profissional.
- Criar conector W.Vetro API somente leitura depois de obter credenciais/teste e responses reais.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
