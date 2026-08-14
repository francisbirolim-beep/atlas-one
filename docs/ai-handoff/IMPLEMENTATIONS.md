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
- adiciona `Importar orçamento W.Vetro` dentro do modal `Nova medição`;
- parser dedicado `lib/wvetroPdf.ts`;
- rota autenticada server-side com `preview` e `confirmar`;
- preserva PDF original e cria orçamento de apoio + Medicao Final;
- medidas do orçamento entram somente como referencia;
- bloqueio de duplicidade por numero W.Vetro;
- merge `56910395fd9f80e08ea8edf170cda45a3b0736c4`.

## Medicao Final — W.Vetro sem medidas no PDF — PR #113 — 2026-08-14
- `FELIPE ALVES SANTANA-861.pdf` possui 7 esquadrias mas nao imprime largura/altura;
- itens identificaveis deixam de ser descartados apenas pela falta de dimensoes;
- zero fica somente no snapshot legado e nunca representa medida real;
- as seis medidas finais permanecem vazias;
- merge `44ce91c5281ec0686ed8db3d1732634cc722498a`.

## Medicao Final — identificacao, telefone e dados manuais da empresa — PR #114 — 2026-08-14
- faixa Cliente/Obra/Orçamento;
- numero externo W.Vetro tem prioridade;
- nome da obra pode ser lido do PDF original preservado;
- telefone do responsavel e puxado do WhatsApp cadastrado com fallback manual;
- dados da empresa legados/seedados deixam de ser tratados como configuracao manual;
- merge `5af697bc154720435b1281c05034888e7a84fba0`.

## Medicao Final — corrigir Cliente/Cidade no preview W.Vetro — PR #115 — 2026-08-14
- teste do PDF 861 mostrou Cliente `CELULARTEL. FIXO:` e Cidade `396 JOSE BONIFACIO - SP`;
- parser passa a priorizar o nome apos o numero do orçamento e limpar o CEP da cidade;
- merge `20aaa50845bf0a37da44db2394a155571669093a`.

## Medicao Final — reaproveitar orçamento de apoio W.Vetro antigo — PR #116 — 2026-08-14
- permite reparar/reaproveitar apoio antigo sem Medicao Final;
- duplicidade continua bloqueada quando ja existe Medicao Final;
- PDF original preservado e reutilizado;
- merge `09514a5feb16a89d333e343732c3bcf873cba4c4`.

## Medicao Final — ocultar apoios W.Vetro do seletor Atlas — PR #117 — 2026-08-14
- `listarOrcamentosSemMedicao()` deixa de mostrar registros internos cujo `descricao_livre` comeca por `Importado do W.Vetro |`;
- o filtro vale apenas para `OU USAR ORÇAMENTO DO ATLAS`;
- o registro de apoio permanece no banco e continua acessivel ao importador W.Vetro;
- orcamentos comerciais reais continuam elegiveis;
- merge `7a16d4161174ab4ddd78151da9d99b6946364c14`.

## Medicao Final — cliente W.Vetro com rotulos concatenados — branch fix/wvetro-cliente-rotulo-concatenado — 2026-08-14
- teste apos a PR #117 confirmou que o card antigo sumiu antes da selecao do PDF, mas o preview do PDF 861 ainda retornou Cliente `CELULARTEL. FIXO:`;
- o arquivo real contem `Cep Numero: 861`, seguido por `FELIPE ALVES SANTANA (11)94641-2756` e depois pelos rotulos `CLIENTE: TEL. FIXO: CELULAR`;
- causa: `pdf-parse` pode concatenar esses rotulos como `CELULARTEL. FIXO:` e a validacao anterior dependia de limite de palavra apos `CELULAR`, permitindo a linha falsa passar;
- `nomePossivelCliente()` agora compacta acentos/pontuacao/espacos e rejeita linhas com dois ou mais rotulos conhecidos concatenados;
- a regra nao usa um simples `startsWith('TEL')`, evitando rejeitar nomes reais como `TELMA`;
- cidade, 7 itens, medidas e fluxo de confirmacao nao foram alterados;
- resultado esperado no PDF 861: Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.

## W.Vetro API — levantamento de integracao — 2026-08-14
- endpoints mapeados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes;
- futura integracao deve ser server-side e Atlas continua sendo fonte da verdade;
- preferir API/JSON estruturado quando autenticada e validada, mantendo PDF como fallback/documento original;
- ainda nao foi confirmado acesso API a receitas/BOM, formulas, usinagens, lista/plano de corte ou otimizacao.

## Pontos funcionais ainda pendentes
- Validar em producao o preview do PDF 861 apos a nova rejeicao de rotulos concatenados.
- Confirmar Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP` e 7 itens.
- Confirmar que `CELULARTEL. FIXO:` continua ausente do seletor Atlas antes da selecao do PDF.
- Validar a faixa Cliente/Obra/Orçamento e o telefone automatico do responsavel.
- Confirmar que Dados da Empresa fica vazio ate configuracao manual.
- Fazer regressao com `FRANCIS TESTE-977.pdf`.
- Criar `Configurações -> Orçamento` e PDF Atlas profissional.
- Criar conector W.Vetro API somente leitura depois de obter credenciais/teste e responses reais.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
