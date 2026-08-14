# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #115 (`20aaa50845bf0a37da44db2394a155571669093a`). A branch atual `fix/wvetro-orcamento-apoio-antigo` corrige o reaproveitamento de um orçamento de apoio W.Vetro antigo que ficou sem Medicao Final.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo`, com multiplas fotos e `Adicionar fotos`.
- PR #106: fotos de LARGURA e ALTURA ficam identificadas e separadas das fotos gerais.
- PR #107: leitura por IA das fotos de trena/laser no Kanban.
- PR #108: corrige a inversao Baixo/Cima da LARGURA observada em teste real.
- PR #109: anexo W.Vetro recebe titulo padrao e fica liberado sem titulo manual.
- PR #110: leitura automatica do valor total do PDF W.Vetro.
- PR #111: moeda BRL correta e envio/reenvio individual de anexos.
- PR #112: `Nova medição` permite importar PDF W.Vetro, revisar e criar a Medicao Final preservando o PDF original.
- PR #113: PDFs W.Vetro sem largura/altura deixam de ser rejeitados; nenhuma dimensao e inventada.
- PR #114: faixa Cliente/Obra/Orçamento; telefone do responsavel pelo WhatsApp cadastrado; dados da empresa somente quando salvos manualmente.
- PR #115: parser do preview W.Vetro prioriza o nome real do cliente e limpa o CEP da cidade; referencia `FELIPE ALVES SANTANA-861.pdf` -> Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.
- Cadastro tecnico de linhas existe em `linhas_tecnicas`, com relacionamentos `linha_produtos` e `linha_tipologias`.

## EM VALIDACAO — ORCAMENTO DE APOIO W.VETRO ANTIGO SEM MEDICAO
Novo teste visual apos a PR #115 mostrou, no bloco `OU USAR ORÇAMENTO DO ATLAS`, um card antigo com:
- Cliente `CELULARTEL. FIXO:`;
- Cidade `396 JOSE BONIFACIO - SP`.

Esse card tem os mesmos valores incorretos produzidos pelo parser antigo do PDF 861. A funcao atual lista orcamentos vendidos sem Medicao Final, portanto um orçamento de apoio criado por uma importacao W.Vetro anterior pode reaparecer ali se ficou sem medicao.

A branch `fix/wvetro-orcamento-apoio-antigo` altera `POST /api/medicao-final/importar-wvetro`:
- se o mesmo numero W.Vetro ja tiver uma Medicao Final, continua bloqueando duplicidade e retorna a medicao existente;
- se existir somente o orçamento de apoio, sem Medicao Final, ele deixa de bloquear a importacao;
- o registro antigo e reaproveitado e atualizado com Cliente/Cidade/itens lidos pelo parser atual;
- o PDF W.Vetro original ja preservado e reutilizado quando disponivel, evitando upload duplicado;
- depois cria a Medicao Final e seus itens normalmente;
- em falha posterior, um orçamento antigo reaproveitado nao e apagado; apenas registros novos criados na operacao podem sofrer rollback.

Resultado esperado no caso 861: selecionar novamente o PDF, confirmar Cliente `FELIPE ALVES SANTANA` / Cidade `JOSE BONIFACIO - SP`, criar a Medicao Final vinculada ao registro antigo e fazer o card incorreto deixar de aparecer como orçamento sem medicao.

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
- Reaproveitamento/reparo de orçamento de apoio W.Vetro antigo sem medicao na branch atual.
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
