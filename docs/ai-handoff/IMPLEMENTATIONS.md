# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

## Medicao Final V2 — PRs #54 a #56
- responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios;
- checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas;
- link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da Vercel.

## Redesign profissional — PRs #57 a #63
Home executiva, Sidebar, Kanban Comercial, Central/Pesquisa de Orcamentos, Medicao Final, Producao e base profissional para setores.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
Entrada automatica apos Medicao Final aprovada, rota `/engenharia`, conferencia tecnica e liberacao transacional/idempotente para Producao.

## Kanban — fotos, trena e W.Vetro — PRs #104 a #111 — 2026-08-13
Fotos de campo, leitura por IA da trena, correcao Baixo/Cima, anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual.

## Medicao Final — importacao W.Vetro — PRs #112 a #118 — 2026-08-14
Importacao direta em `Nova medição`, suporte a PDFs sem dimensoes, preservacao do original, reparo de apoios antigos e correcoes do parser. Teste do PDF 861 confirmou FELIPE ALVES SANTANA, JOSE BONIFACIO - SP e 7 itens.

## Medicao Final — medidas fixas e fotos da trena — PR #119 — 2026-08-14
- 3 larguras + 3 alturas fixas por peca;
- foto da trena da LARGURA e ALTURA;
- `medido=true` somente com as seis medidas positivas;
- heranca de medidas/fotos somente de orcamento Atlas `tipo_medida=final`.

## Medicao Final — padroes SIM/NAO e vista interna — PR #120 — 2026-08-14
- CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA com SIM/NAO por peca;
- observacao por peca;
- lembrete para medir pela vista interna do vao.

## Medicao Final — ordem do fluxo por peca — PR #121 — 2026-08-14
- tabela SIM/NAO movida para logo abaixo das medidas finais;
- observacao logo depois;
- remove barra/painel duplicado de pecas;
- demais campos e fotos adicionais ficam na sequencia.

## Medicao Final — parcial, tempo e historico — PR #122 — 2026-08-14
- cronometro de tempo ativo apos inicio;
- `Salvar medição parcial` pausa sem apagar dados;
- `Retomar medição` continua a mesma medicao;
- cada peca mostra `✅ FEITA` ou `EM ABERTO`;
- historico registra inicio, parcial e retomada com data/hora, usuario e contagem feita/em aberto;
- reutiliza `medicao_revisoes`, sem migration nova.

## Navegacao mobile — Favoritos — PR #123 — 2026-08-14
- remove visualmente no celular a barra inferior extensa do `Sidebar`, mantendo-a intacta no desktop;
- cria botao compacto `Favoritos` fixo no mobile;
- abre painel inferior para acessar e editar favoritos;
- permite favoritar/desfavoritar paginas e setores;
- reaproveita preferencias ja existentes;
- tela Inicio ganha bloco `Acesso rápido / Favoritos`.

## Navegacao mobile — Voltar e Inicio — PR #124 — 2026-08-14
- novo componente `MobileNavigationControls` somente para celular;
- fora da Home mostra `Voltar` e `Inicio` no canto inferior esquerdo;
- `Voltar` usa o historico do navegador e possui fallback para `/`;
- `Inicio` sempre retorna para a Home;
- Favoritos permanece independente no canto inferior direito.

## Medicao Final — remover duplicata generica — branch `fix/remover-medida-final-duplicada` — 2026-08-14
- confirma `/producao/medicao-final` como unica Medicao Final oficial;
- adiciona a rota oficial como pagina fixa de navegacao/favoritos;
- filtra o setor generico legado `Medida final`/`Medicao final` das listas globais quando nao aponta para a rota oficial;
- remove a duplicata de Favoritos, Setores, Sidebar e demais consumidores de `listarSetores()`;
- o Kanban generico antigo deixa de ser oferecido pela navegacao normal;
- registro legado nao e excluido fisicamente do banco nesta etapa.

## W.Vetro API — levantamento de integracao — 2026-08-14
Endpoints mapeados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes. Futura integracao deve ser server-side e Atlas continua fonte da verdade.

## Pontos funcionais ainda pendentes
- Validar no iPhone que em Favoritos aparece somente a Medicao Final oficial e a duplicata generica desapareceu.
- Validar PR #124 no iPhone.
- Validar em celular a medicao parcial: iniciar -> medir algumas pecas -> salvar parcial -> recarregar -> conferir feitas/em aberto -> retomar -> concluir restante.
- Validar persistencia dos SIM/NAO/observacao, seis medidas e fotos em campo.
- Replicar parcial/campos fixos no link externo se ele for usado como interface principal do medidor.
- Criar `Configurações -> Orçamento` e PDF Atlas profissional.
- Criar conector W.Vetro API somente leitura depois de credenciais/testes reais.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
