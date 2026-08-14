# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #113 (`44ce91c5281ec0686ed8db3d1732634cc722498a`). A branch atual `fix/medicao-link-telefone-responsavel` ajusta identificacao, contato do responsavel e configuracao manual dos dados da empresa.

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
- PR #113: PDFs W.Vetro com itens identificaveis mas sem largura/altura deixam de ser rejeitados; nenhuma dimensao e inventada e as seis medidas finais continuam vazias.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.
- Cadastro tecnico de linhas existe em `linhas_tecnicas`, com relacionamentos `linha_produtos` e `linha_tipologias`.

## EM VALIDACAO — AJUSTES DE USO REAL DA MEDICAO FINAL
Branch `fix/medicao-link-telefone-responsavel`:
- adiciona faixa de identificacao no topo da Medicao Final com `Cliente`, `Nome da obra` e `Orçamento`;
- numero do orçamento prioriza o numero externo W.Vetro quando a medicao foi importada, evitando mostrar apenas o serial interno do Atlas;
- para importacoes W.Vetro ja existentes, a rota server-side de identificacao tenta obter `NOME DA OBRA` diretamente do PDF original preservado; no `FELIPE ALVES SANTANA-861.pdf`, o valor esperado e `CASA`;
- no bloco `Link externo da Medicao Final`, o nome e telefone sao preenchidos pelo responsavel selecionado quando ele existe em `usuarios` e possui `whatsapp` cadastrado;
- se o responsavel nao tiver telefone cadastrado ou o nome for externo, o telefone permanece editavel para preenchimento manual;
- o campo de nome do medidor oferece os usuarios cadastrados como sugestao;
- `dados_empresa` legado/seedado deixa de ser tratado como configuracao do usuario; somente valores salvos manualmente na tela passam a ser retornados por `lerDadosEmpresa()`.

## W.VETRO — REFERENCIA FUNCIONAL VALIDADA
`FELIPE ALVES SANTANA-861.pdf`:
- orçamento `861`;
- cliente `FELIPE ALVES SANTANA`;
- nome da obra `CASA` no documento;
- cidade `JOSE BONIFACIO / SP`;
- 7 itens;
- ambientes: `WC SUITE`, `WC`, `WC`, `QUARTO`, `SUITE`, `QUARTO`, `QUARTO`;
- tipologias: 3 maxim-ar, 1 porta de giro, 1 porta de correr, 1 janela de correr integrada e 1 janela de correr;
- linha Suprema;
- esse layout nao imprime largura/altura das esquadrias.

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
- Ajustes da branch `fix/medicao-link-telefone-responsavel` aguardam Build Validation e teste em producao.
- Confirmacao de Venda Fase 1.
- Importacao generica de itens via PDF; layouts W.Vetro podem variar e precisam de validacao por amostras reais.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Entidade persistente `vendas`/`obras` ainda nao existe; por isso o nome da obra de importacoes W.Vetro ainda e lido do documento quando necessario, em vez de existir como entidade propria.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio criado pela importacao direta W.Vetro ainda usa a estrutura atual de `orcamentos`; nao existe uma entidade propria de integracao W.Vetro.
- Em PDFs W.Vetro que nao exibem medidas, o snapshot de apoio usa zero para satisfazer o formato legado de `ItemEsquadria`; isso NAO representa medida real nem deve alimentar calculo tecnico.
- A futura integracao API deve preservar IDs/codigos W.Vetro e JSON bruto sem transformar W.Vetro na fonte da verdade do Atlas.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
