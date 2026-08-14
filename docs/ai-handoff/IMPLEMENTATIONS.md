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
- #57: Home executiva + Topbar + KPIs/workspace.
- #58: Sidebar desktop escura em padrao ERP.
- #59: Kanban Comercial profissional.
- #60: Central e Pesquisa de Orcamentos profissionais.
- #61: Medicao Final profissional.
- #62: Producao profissional.
- #63: base profissional para setores sem modulo proprio.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
- entrada automatica da Medicao Final aprovada na Engenharia;
- rota dedicada `/engenharia` e fluxo operacional;
- conferencia tecnica persistente por peca;
- bloqueio de liberacao incompleta;
- liberacao transacional/idempotente Engenharia -> Producao.

## Kanban — fotos coletadas em campo — PRs #104 a #106 — 2026-08-13
- #104 restaurou `Iniciar orçamento` e preservou referencias de foto do pedido.
- #105 criou `Fotos coletadas em campo`, multiplas miniaturas e `Adicionar fotos` sem apagar anteriores.
- #106 identifica `foto_larguras_url` como `LARGURA` e `foto_alturas_url` como `ALTURA`; fotos gerais ficam separadas sem duplicacao.

## Kanban — leitura automatica da trena — PRs #107 e #108 — 2026-08-13
- #107 reutiliza `/api/medicao-final/ler-trena` para ler as fotos do medidor, converter para mm e sugerir seis medidas;
- so preenche automaticamente quando as tres leituras do eixo sao reconhecidas;
- nao sobrescreve automaticamente eixo com valor manual;
- falha da IA nao remove a foto;
- #108 corrige a inversao `Baixo`/`Cima` observada na LARGURA em teste real; ALTURA nao foi alterada.

## Kanban — anexo original W.Vetro — PR #109 — 2026-08-13
- o bloco de anexos ja tinha upload funcional via Supabase Storage, mas exigia titulo manual antes de habilitar o seletor de arquivo;
- a rota `/kanban` passa a preencher automaticamente o titulo vazio com `Orçamento W.Vetro (original)`;
- isso libera o botao `Anexar` sem digitacao manual e padroniza o anexo que sera usado como fonte do futuro espelho Atlas;
- o PDF W.Vetro original continua preservado.

## Kanban — valor total automatico do PDF — PR #110 — 2026-08-13
- nova rota autenticada `POST /api/orcamento/ler-total-pdf` recebe o PDF no momento da selecao;
- usa `pdf-parse` e identifica o valor monetario proximo de `TOTAL`, com fallback para layouts fragmentados;
- aceita `2.716,84`, `2716,84`, `2,716.84` e `2716.84`;
- ao anexar o PDF, o campo `Valor total do orçamento` e preenchido automaticamente;
- exibe confirmacao formatada em BRL e mantem o campo editavel para conferencia;
- PDF real de referencia: `FRANCIS TESTE-977.pdf` -> `R$ 2.716,84`.

## Kanban — moeda BRL e reenvio individual de anexos — PR #111 — 2026-08-13
- corrige card e PDF Atlas para `R$ 2.716,84` em vez de `R$ 2716.84`;
- campo de valor passa a aceitar digitacao apenas numerica com mascara de moeda brasileira;
- valores de itens no PDF tambem usam formatacao BRL;
- cada anexo pode ser enviado/reententado individualmente pelo WhatsApp do vendedor.

## Medicao Final — importar orçamento W.Vetro — PR #112 — 2026-08-14
- adiciona `Importar orçamento W.Vetro` dentro do modal `Nova medição`, preservando o fluxo existente de selecionar um orçamento vendido do Atlas;
- cria parser dedicado `lib/wvetroPdf.ts` para numero do orçamento, cliente, cidade/UF, total e itens com dados tecnicos disponiveis no PDF;
- cria rota autenticada server-side `POST /api/medicao-final/importar-wvetro` com duas etapas: `preview` e `confirmar`;
- a pre-visualizacao deixa conferir/corrigir cliente e cidade antes de gravar;
- ambiente vazio no W.Vetro e permitido e fica explicitamente sinalizado;
- ao confirmar, preserva o PDF original, cria um orçamento de apoio e a Medicao Final com todos os itens reconhecidos;
- largura/altura do orçamento sao apenas referencia; as 3 larguras e 3 alturas de Medicao Final permanecem vazias para medicao real em obra;
- bloqueia duplicacao quando o numero do orçamento W.Vetro e reconhecido;
- PDF limitado a 15 MB e operacoes intermediarias possuem limpeza de rollback quando possivel;
- PR mergeada em `main` no commit `56910395fd9f80e08ea8edf170cda45a3b0736c4`.

## Medicao Final — W.Vetro sem medidas no PDF — PR #113 — 2026-08-14
- teste real com `FELIPE ALVES SANTANA-861.pdf` revelou um layout W.Vetro que possui 7 esquadrias, ambientes, descricoes, quantidades, cores, vidros e linha, mas nao imprime largura/altura;
- a regra anterior descartava esses itens por exigir duas dimensoes e retornava `nenhuma esquadria com largura e altura pôde ser lida`;
- o parser por `LOCAL/AMBIENTE` passa a aceitar itens identificaveis mesmo sem dimensoes;
- largura/altura ausentes ficam zeradas somente no snapshot de apoio legado, acompanhadas de `MEDIDAS NÃO INFORMADAS NO PDF`; zero nao representa tamanho real;
- a Medicao Final grava `REFERÊNCIA ORÇAMENTO: medidas não informadas no PDF` e continua com as seis medidas finais vazias;
- a pre-visualizacao mostra ausencia de medida sem tratar zero como tamanho;
- o parser de cliente foi reforcado para PDFs cujo nome/celular aparecem antes do rotulo `CLIENTE`;
- layouts que realmente trazem largura/altura mantem o comportamento anterior: dimensoes apenas como referencia;
- merge em `main`: `44ce91c5281ec0686ed8db3d1732634cc722498a`.

## Medicao Final — identificacao, telefone do responsavel e dados manuais da empresa — PR #114 — 2026-08-14
- nova faixa `Identificação da Medição Final` mostra `Cliente`, `Nome da obra` e `Orçamento` no topo da tela detalhada;
- nova rota autenticada `GET /api/medicao-final/[id]/identificacao` busca o cliente e o orçamento vinculado;
- quando a origem e W.Vetro, o numero externo do marcador `Importado do W.Vetro | Orçamento N` tem prioridade sobre o serial interno do Atlas;
- quando o nome da obra ainda nao esta persistido, a rota tenta ler o PDF W.Vetro original preservado com `pdf-parse`; no orçamento `861`, a referencia esperada e `CASA`;
- o bloco de link externo consulta o responsavel da Medicao Final e os usuarios cadastrados; se houver WhatsApp cadastrado, preenche o telefone automaticamente;
- nome externo ou usuario sem WhatsApp continua permitindo telefone manual;
- o nome do medidor oferece sugestoes dos usuarios cadastrados;
- `lerDadosEmpresa()` passa a ignorar registro legado/seedado sem marcador de configuracao manual;
- `salvarDadosEmpresa()` grava `configuradoManualmente: true`, garantindo que apenas informacoes efetivamente salvas pelo usuario sejam carregadas nas telas que usam essa configuracao;
- merge em `main`: `5af697bc154720435b1281c05034888e7a84fba0`.

## Medicao Final — corrigir Cliente/Cidade no preview W.Vetro — branch fix/wvetro-cliente-cidade-preview — 2026-08-14
- teste real do `FELIPE ALVES SANTANA-861.pdf` mostrou o preview com Cliente `CELULARTEL. FIXO:` e Cidade `396 JOSE BONIFACIO - SP`;
- o PDF tem o nome real logo apos `Cep Numero: 861`: `FELIPE ALVES SANTANA (11)94641-2756`;
- o texto extraido tambem contem `CEP: 15202-396 JOSE BONIFACIO/SP -`, e o parser antigo tratava o hifen do CEP como separador de cidade;
- `extrairCliente` passa a priorizar o nome imediatamente apos a linha do numero do orçamento e `nomePossivelCliente` rejeita rotulos de cabecalho como CELULAR/TEL/FIXO/CONTATO;
- `extrairCidadeUf` passa a reconhecer primeiro `CEP + cidade/UF` e remover o CEP antes de usar fallbacks;
- resultado esperado no preview 861: Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, mantendo os 7 itens.

## W.Vetro API — levantamento de integracao — 2026-08-14
- foram mapeados endpoints publicos para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes;
- decisao de arquitetura: futura integracao deve ser server-side e Atlas continua sendo a fonte da verdade;
- preferir API/JSON estruturado para dados W.Vetro quando estiver autenticada e validada, mantendo PDF como documento original/fallback;
- ainda nao foi confirmado acesso API a receitas/BOM, formulas, usinagens, lista/plano de corte ou otimizacao.

## Pontos funcionais ainda pendentes
- Validar em producao o preview corrigido de `FELIPE ALVES SANTANA-861.pdf`: Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.
- Validar a faixa Cliente/Obra/Orçamento e o preenchimento automatico do telefone do responsavel.
- Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
- Continuar o teste da Medicao Final `861` e fazer regressao com `FRANCIS TESTE-977.pdf`.
- Criar `Configurações -> Orçamento` para dados e textos configuraveis do documento.
- Fazer todos os PDFs Atlas consumirem somente configuracoes manuais, removendo textos de empresa hardcoded remanescentes.
- Gerar `Orçamento Atlas` profissional e depois evoluir para espelho do PDF W.Vetro, com leitura estruturada + revisao.
- Criar conector W.Vetro API somente leitura, depois de obter credenciais/teste e exemplos de resposta.
- Engenharia Fase 5: base de receitas tecnicas por tipologia.
- MEE/calculos automaticos, perfis/acessorios, lista de materiais, lista de corte e otimizacao.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
