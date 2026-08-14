# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #116 (`09514a5feb16a89d333e343732c3bcf873cba4c4`). A branch atual `fix/ocultar-apoio-wvetro-seletor-atlas` corrige a exibicao indevida de orcamentos internos de apoio W.Vetro no bloco `OU USAR ORÇAMENTO DO ATLAS`.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PR #112: `Nova medição` permite importar PDF W.Vetro, revisar e criar a Medicao Final preservando o PDF original.
- PR #113: PDFs W.Vetro sem largura/altura deixam de ser rejeitados; nenhuma dimensao e inventada.
- PR #114: faixa Cliente/Obra/Orçamento; telefone do responsavel pelo WhatsApp cadastrado; dados da empresa somente quando salvos manualmente.
- PR #115: parser do preview W.Vetro prioriza o nome real do cliente e limpa o CEP da cidade; referencia `FELIPE ALVES SANTANA-861.pdf` -> Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`.
- PR #116: se existir um orçamento de apoio W.Vetro antigo sem Medicao Final, a nova importacao pode reaproveita-lo e corrigi-lo; duplicidade so bloqueia quando ja existe Medicao Final vinculada.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.
- Cadastro tecnico de linhas existe em `linhas_tecnicas`, com relacionamentos `linha_produtos` e `linha_tipologias`.

## EM VALIDACAO — OCULTAR APOIOS W.VETRO DO SELETOR DE ORCAMENTOS ATLAS
Novo teste visual em producao, mesmo depois da PR #116, mostrou que ao simplesmente abrir `Nova medição` o bloco `OU USAR ORÇAMENTO DO ATLAS` ainda exibe um card antigo com:
- Cliente `CELULARTEL. FIXO:`;
- Cidade `396 JOSE BONIFACIO - SP`.

A causa esta em `listarOrcamentosSemMedicao()` (`lib/medicaoFinal.ts`): esse seletor lista todos os orcamentos que estao em coluna de venda e ainda nao possuem Medicao Final, sem distinguir um orçamento comercial real do Atlas de um orçamento interno de apoio criado pela importacao W.Vetro.

A branch `fix/ocultar-apoio-wvetro-seletor-atlas`:
- inclui `descricao_livre` na consulta usada pelo seletor;
- identifica como apoio W.Vetro qualquer registro cujo marcador comece por `Importado do W.Vetro |`;
- remove esses registros apenas da lista `OU USAR ORÇAMENTO DO ATLAS`;
- nao apaga nem altera o registro no banco;
- o importador W.Vetro continua podendo localizar/reaproveitar o apoio antigo pelo marcador externo;
- orcamentos comerciais reais do Atlas continuam aparecendo normalmente quando vendidos e sem Medicao Final.

Resultado esperado: abrir `Nova medição` e o card `CELULARTEL. FIXO:` nao aparecer mais, mesmo antes de selecionar qualquer PDF.

## W.VETRO — REFERENCIA FUNCIONAL
`FELIPE ALVES SANTANA-861.pdf`:
- orçamento `861`;
- cliente `FELIPE ALVES SANTANA`;
- nome da obra `CASA`;
- cidade `JOSE BONIFACIO / SP`;
- 7 itens;
- ambientes: `WC SUITE`, `WC`, `WC`, `QUARTO`, `SUITE`, `QUARTO`, `QUARTO`;
- 3 maxim-ar, 1 porta de giro, 1 porta de correr, 1 janela de correr integrada e 1 janela de correr;
- linha Suprema;
- esse layout nao imprime largura/altura das esquadrias.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- A documentacao publica `Wvetro Integrations v2` e os endpoints enviados pelo usuario foram avaliados como potencial fonte estruturada para Atlas.
- Endpoints relevantes: linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, itens de NF, estoque, financeiro, lotes, producao de projeto e instalacoes.
- Estrategia futura: preferir API W.Vetro -> JSON estruturado -> Atlas; manter PDF como fallback/documento original.
- Credenciais W.Vetro nunca devem ficar no browser; futura integracao sera server-side.
- Ainda nao foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras.

## ENGENHARIA — ESTADO REAL
- Fase 1 concluida: Medicao Final aprovada entra automaticamente na Engenharia.
- Fase 2 concluida: rota `/engenharia` e fluxo operacional.
- Fase 3 concluida: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- Fase 4 concluida: liberacao transacional/idempotente Engenharia -> Producao.
- Ainda nao existe MEE/calculo tecnico automatico, receitas de tipologias, lista de corte ou otimizacao.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Filtro dos orcamentos internos de apoio W.Vetro no seletor `OU USAR ORÇAMENTO DO ATLAS` da branch atual.
- Confirmacao de Venda Fase 1.
- Importacao generica de itens via PDF; layouts W.Vetro podem variar e precisam de validacao por amostras reais.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio da importacao W.Vetro ainda usa `orcamentos`; nao existe entidade propria de integracao W.Vetro.
- Em PDFs W.Vetro sem medidas, o snapshot de apoio usa zero apenas por compatibilidade legada; isso nao representa medida real.
- A futura integracao API deve preservar IDs/codigos W.Vetro e JSON bruto sem transformar W.Vetro na fonte da verdade do Atlas.
- Design System ainda nao foi aplicado em todas as telas antigas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
