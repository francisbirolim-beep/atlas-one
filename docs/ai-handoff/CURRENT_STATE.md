# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #112 (`56910395fd9f80e08ea8edf170cda45a3b0736c4`). A branch atual `fix/medicao-wvetro-sem-medidas` corrige um caso real de orçamento W.Vetro que lista as esquadrias, mas nao imprime largura/altura.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo` antes das medidas, com multiplas fotos e `Adicionar fotos` sem apagar as anteriores.
- PR #106: `foto_larguras_url` aparece como `LARGURA`, `foto_alturas_url` como `ALTURA` e fotos gerais ficam em `Outras fotos` sem duplicacao.
- PR #107: leitura por IA das fotos de LARGURA/ALTURA no Kanban, conversao para mm e preenchimento das seis medidas somente quando as tres leituras do eixo forem reconhecidas.
- PR #108: corrige a inversao Baixo/Cima da LARGURA observada em teste real; exemplo validado `Baixo 1790 / Meio 1791 / Cima 1789`. ALTURA permanece sem alteracao.
- PR #109: anexo W.Vetro recebe titulo padrao `Orçamento W.Vetro (original)` e o botao `Anexar` fica liberado sem digitacao manual.
- PR #110: leitura automatica do valor total do PDF W.Vetro no Kanban; referencia `FRANCIS TESTE-977.pdf` -> `R$ 2.716,84`.
- PR #111: card, campo e PDF Atlas usam formatacao BRL; cada anexo pode ser `Enviar`/`Reenviar` individualmente ao vendedor.
- PR #112: `Nova medição` permite importar um PDF W.Vetro, revisar os dados e criar a Medicao Final preservando o PDF original.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.
- Cadastro tecnico de linhas existe em `linhas_tecnicas`, com relacionamentos `linha_produtos` e `linha_tipologias`.

## EM VALIDACAO — W.VETRO SEM LARGURA/ALTURA NO PDF
Teste real em producao com `FELIPE ALVES SANTANA-861.pdf` mostrou:
- o W.Vetro foi reconhecido;
- o PDF possui 7 itens identificaveis por `LOCAL/AMBIENTE`, descricao, quantidade, cor, vidro e linha;
- esse modelo de documento NAO imprime largura e altura das esquadrias;
- a versao da PR #112 bloqueava a importacao porque exigia largura+altura para considerar o item valido.

A branch `fix/medicao-wvetro-sem-medidas` altera a regra:
- uma esquadria W.Vetro identificavel nao e descartada apenas porque o PDF nao traz dimensoes;
- parser por `LOCAL/AMBIENTE` aceita item sem medidas e grava `largura_mm=0` / `altura_mm=0` apenas no snapshot de apoio, sem inventar dimensao;
- a descricao recebe `MEDIDAS NÃO INFORMADAS NO PDF`;
- na Medicao Final a referencia fica `medidas não informadas no PDF`;
- as seis medidas finais continuam vazias como antes;
- a pre-visualizacao mostra `Sem medida no PDF` em vez de `0 x 0`;
- quando outro layout W.Vetro trouxer largura/altura, elas continuam sendo apenas referencia e nunca medida final;
- extracao de cliente foi reforcada para layouts em que nome/celular aparecem antes do rotulo `CLIENTE`.

Referencia funcional esperada para `FELIPE ALVES SANTANA-861.pdf`:
- orçamento `861`;
- cliente `FELIPE ALVES SANTANA`;
- cidade `JOSE BONIFACIO / SP`;
- 7 itens;
- ambientes: `WC SUITE`, `WC`, `WC`, `QUARTO`, `SUITE`, `QUARTO`, `QUARTO`;
- tipologias: 3 maxim-ar, 1 porta de giro, 1 porta de correr, 1 janela de correr integrada e 1 janela de correr;
- linha Suprema;
- sem largura/altura no documento.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- A documentacao publica `Wvetro Integrations v2` e os endpoints enviados pelo usuario foram avaliados como potencial fonte estruturada para Atlas.
- Endpoints relevantes identificados incluem linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos, orcamentos, compras/NF, itens de NF, estoque, financeiro, lotes, producao de projeto e instalacoes.
- Estrategia futura: preferir API W.Vetro -> JSON estruturado -> Atlas; manter leitura de PDF como fallback/documento original.
- Nao colocar credenciais W.Vetro no browser; futura integracao deve ser server-side.
- Ainda NAO foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras. Nao assumir que esses dados estao liberados pela API.

## ENGENHARIA — ESTADO REAL
- Fase 1 concluida: Medicao Final aprovada entra automaticamente na Engenharia.
- Fase 2 concluida: rota `/engenharia` e fluxo Recebidas -> Conferencia tecnica -> Em desenvolvimento -> Liberado para producao.
- Fase 3 concluida: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- Fase 4 concluida: liberacao transacional/idempotente Engenharia -> Producao.
- Ainda nao existe MEE/calculo tecnico automatico, receitas de tipologias, lista de corte ou otimizacao.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Ajuste da importacao W.Vetro sem dimensoes na branch `fix/medicao-wvetro-sem-medidas`.
- Confirmacao de Venda Fase 1.
- Importacao generica de itens via PDF; layouts W.Vetro podem variar e precisam de validacao por amostras reais.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio criado pela importacao direta W.Vetro ainda usa a estrutura atual de `orcamentos`; nao existe uma entidade propria de integracao W.Vetro.
- Em PDFs W.Vetro que nao exibem medidas, o snapshot de apoio usa zero para satisfazer o formato legado de `ItemEsquadria`; isso NAO representa medida real nem deve alimentar calculo tecnico.
- A futura integracao API deve preservar IDs/codigos externos e JSON bruto sem transformar W.Vetro na fonte da verdade do Atlas.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Importacao W.Vetro exige sessao Atlas valida no servidor.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
