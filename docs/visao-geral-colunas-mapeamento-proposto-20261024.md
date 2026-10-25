# Atlas One — proposta de colunas e integração com Cliente 360 (24/10/2026)

**Status:** proposta para alinhamento com Francis, **não homologada**, não publicada. Worktree: `Atlas-One-VisaoGeral-Etapas-20261024`. A versão atual em uso não é alterada.

## Princípio

A Visão Geral é **projeção de leitura** de um card por venda confirmada vinculada a obra. Cada card aponta ao Cliente 360 e mostra tipologias, percentuais por material, impedimentos, responsáveis e linha do tempo. Os Kanbans operacionais são a fonte da verdade; nenhuma movimentação visual cria ordem, libera compra/produção, agenda instalação ou encerra obra.

## Nove colunas propostas

| Ordem | Coluna (nome editável) | Fonte operacional | Entrada verificável | Saída verificável |
|---|---|---|---|---|
| 1 | **Vendido** | Vendas / Cliente 360 | Venda confirmada vinculada a obra | Trabalho técnico iniciado por evento real |
| 2 | **Medição final** | Medição final / engenharia / Cliente 360 | Medição final demandada ou iniciada para obra | Todas as tipologias aplicáveis conferidas/aprovadas, ou dispensa expressa |
| 3 | **Separação de materiais** | Engenharia / lista técnica / Cliente 360 | Lista efetiva de perfis, vidros e acessórios gerada e destinada a compras/estoque | Necessidades conferidas, com decisão de estoque versus compra |
| 4 | **Compras** | Compras / cotações / pedidos | Necessidades autorizadas, cotação ou pedido real | Pedidos emitidos ou atendimento por estoque comprovado |
| 5 | **Aguardando materiais** | Compras / recebimento / estoque | Itens requeridos ainda não recebidos ou não reservados | Todos os materiais exigidos liberados conforme registros |
| 6 | **Aguardando liberação de produção** | Engenharia / Produção | Preparação de materiais e medições suficientes; OP ainda não liberada | Liberação técnica real da(s) OP(s) |
| 7 | **Produção** | Ordens de produção / peças | Primeira OP efetivamente iniciada | Todas as peças do escopo concluídas e conferidas |
| 8 | **Instalação** | Instalação / agendamentos / peças | Instalação agendada ou execução iniciada (exibir substatus) | Todas as peças concluídas, checklists aprovados e sem pendências |
| 9 | **Finalizado** | Cliente 360 / encerramento da obra | Encerramento oficial confirmado + produção/instalação integralmente concluídas | Permanece finalizado até um evento oficial de reabertura |

**Observação sobre medição e compras:** são processos que podem se sobrepor. O card deve preservar a posição principal mais avançada comprovada e exibir alertas paralelos (ex.: **Em produção · 2 vidros pendentes**), sem dar baixa falsa nas etapas anteriores. Não presumir uma medição aprovada por simples presença de registro; uma lista criada não implica necessidade aprovada; pedido emitido não implica material recebido; recebimento não implica material liberado.

## Edição pelo Master

- **Renomear e reordenar** altera somente apresentação; critérios e eventos permanecem.
- **Criar coluna** exige definir vínculo a um evento ou substatus verificável (ex.: «Aguardando aprovação da compra»). Enquanto sem critério, manter como coluna em configuração, **não movimentar cards automaticamente** para ela.
- **Excluir coluna** exige indicar destino para todos os critérios; nenhum registro operacional ou card é apagado.
- Um estágio livre de acompanhamento manual, se for necessário, deve ser assinalado como **manual** e não substituir liberação/conclusão de operação. Histórico e autor são obrigatórios.
- Configuração futura deve ser persistida no servidor por empresa, com auditoria e acesso Master; não depender de armazenamento local como fonte da verdade.

## Painel lateral do card

- Cliente, obra, identificação de venda, tipologias/peças, previsão de entrega, prazo da etapa, tempo e motivo do atraso, etapas concluídas, responsável e histórico.
- **Perfis, vidros, acessórios:** quantidade necessária, comprada **e** recebida, totais e percentuais calculados por **quantidade/unidade compatível**. Nunca interpretar número de linhas como quantidade comprada quando cada linha tem múltiplas peças. Se falta planejamento, mostrar **Não apurado**, não 0%/100%.
- Cada linha de perfis/acessórios deve usar imagem do produto vinculada ao cadastro de mesma empresa/ID; sem imagem, indicar **Imagem pendente**, nunca substituir por foto aleatória.
- Botões **Abrir Cliente 360**, **Abrir Compras**, **Abrir Produção** e **Abrir Instalação** usam IDs reais e respeitam permissões.
- Sem financeiro na TV por padrão. Regras de cores seguem semáforo já definido. Mostrar data/hora da última sincronização válida.

## Integração técnica existente e pendências antes da homologação

Já há estrutura pura de mapeamento em `lib/visaoGeralProjetos.ts`, com **seis colunas agrupadas**. Há um endpoint inicial de leitura `app/api/visao-geral-projetos/route.ts` **ainda em construção e não homologado**; **não usar em produção**, pois a integração precisa validar os eventos exatos, o fechamento de todas as tipologias, os recebimentos/estoque e o vínculo das compras por obra/venda. Os nomes/colunas acima são uma **proposta de nove colunas**, a alinhar antes de ajustar a implementação.

Referências existentes: `lib/vendaFluxoResumo.ts`, `app/api/kanban-central/route.ts` e Cliente 360. A primeira exposição deve restringir-se a Master até revisão específica de permissões agregadas. Sem migração nem publicação nesta etapa.

## Testes de aceitação obrigatórios

- Venda não confirmada não gera card; cliente com duas obras gera cards separados.
- Venda com algumas peças medidas não aparece integralmente medida.
- Compra/estoque separados de recebimento; percentuais por categoria sem «completo» falso.
- OP bloqueada não vira produção iniciada; instalação não avança por arraste.
- Prazos ausentes recebem estado «Sem prazo», não verde.
- Coluna criada/renomeada/reordenada/excluída conserva mapeamento e histórico; usuário não Master não configura.
- Clique abre o Cliente 360 correto e respeita empresa/usuário, inclusive multiobra.
- TV atualiza por leitura e não expõe valores financeiros por padrão.
- Comparar com versão homologada, executar regressões, preparar rollback e solicitar aprovação **específica** antes de produção.

## Refinamento discutido — um card, retorno de etapa e medição parcial (24/10/2026)

**Não multiplicar colunas** para cada substatus. Em vez de criar «Aguardando Medição Final» como nova coluna, conservar a coluna **Medição Final** e mostrar no próprio card: **Aguardando**, **Em andamento**, **Pendência / Revisão** ou **Concluída**, sempre por evidência real e, quando aplicável, por tipologia/peça. Ex.: «Medição final · 3 de 5 tipologias aprovadas · 2 pendentes».

**Card único por venda/obra** (não duplicar ao reabrir). O painel lateral mostrará as peças já medidas e as pendentes, o histórico de cada mudança e a ação que falta. Para uma venda com 5 peças, concluir 3 não conclui a medição da obra inteira.

**Avançar e voltar:** a exibição pode mudar para uma etapa anterior quando uma atividade realmente for reaberta ou surgir bloqueio que impeça o avanço, com origem da pendência, autor, data, motivo e histórico. Uma movimentação visual manual não revoga registros operacionais nem desfaz aprovações de medições ou ordens existentes; correções reais devem ocorrer no próprio setor autorizado. Se algumas peças já estiverem legitimamente em Produção/Instalação e outras ainda aguardarem medição, preservar o progresso adiantado e expor a pendência paralela em destaque, sem forçar o projeto inteiro a retroceder. O dono do projeto visual terá apenas uma posição principal.

**Separação antes da compra:** no card da coluna Vendido, mostrar três barras independentes (**Perfis, Vidros e Acessórios**) com rótulo inequívoco de **separado/definido**, e não de comprado. No painel lateral, separar três métricas por categoria: **necessário/definido**, **comprado** e **recebido**, calculadas por quantidades válidas. Não inventar percentual quando o total técnico for desconhecido.

**Planejamento de instalação desde Vendido:** no card e no painel lateral, mês previsto de instalação; ao abrir, calendário com reserva de capacidade mensal, total financeiro planejado (R$) e situação prevista versus confirmada. Data prevista comercial **não equivale** a instalação agendada. Capacidade deverá usar disponibilidade real das equipes e duração/complexidade da obra (se houver dados); montante em R$ é indicador comercial complementar, não prova de capacidade física. Reprogramações preservam histórico e sincronizam o Cliente 360 sem agendar instalação automaticamente.

**Status da proposta:** regras de UX/modelagem pendentes de homologação funcional. Não atualizar banco nem publicar com base neste documento.

## Refinamento de sequência — compras de vidro em paralelo com produção (conversa de 24/10/2026)

**Sequência visual preferida, ainda em discussão:** 1. Vendido → 2. Separação de materiais → 3. Compras → 4. Medição Final → 5. Produção → 6. Instalação → 7. Finalizado. Esta proposta de **sete colunas compactas** substitui, para discussão, a disposição anterior de nove etapas; «Aguardando materiais» e «Aguardando liberação da produção» passam a ser substatus/alertas, não colunas obrigatórias. Não modificar o código das colunas antes de concluir o alinhamento funcional.

- **Vendido:** três barras de **preparação/separação** de perfis, vidros e acessórios, claramente rotuladas; calendário de mês previsto de instalação e carga planejada. Separar não significa comprar.
- **Separação:** lista técnica de perfis/acessórios e itens de vidro sujeitos à medição definitiva; conferir estoque e necessidades. Não marcar vidro pronto para pedir antes de ter medidas confirmadas quando a tipologia depende disso.
- **Compras:** acompanhar perfis e acessórios em cotação, pedido e recebimento, mesmo se medição final já estiver em andamento. A compra de vidros pode começar **após a medida final aprovada** para as tipologias que dependam das dimensões de obra. Nenhuma conclusão da coluna implica 100% de vidro comprado.
- **Medição Final:** card mostra «Aguardando / Em andamento / Pendências / Concluída», por peça. A aprovação efetiva das medidas dispara elegibilidade de cotação/pedido do vidro na fonte oficial (não gerar compra automática se não houver autorização). A medição pode coexistir com compras e produção por peça, sem voltar atrás nem duplicar cards.
- **Produção:** se as peças/OPs estiverem efetivamente liberadas, o corte/montagem de perfis pode avançar enquanto os vidros ainda estão em cotação/compra/entrega. Mostrar alerta destacado «Vidros: 40% comprados · 0% recebidos» e especificar tipologias afetadas. Não liberar, finalizar ou instalar peças que exigem vidro não recebido, a não ser que o fluxo oficial tenha regra expressa que suporte essa operação.
- **Instalação:** depende das liberações reais, do vidro e demais itens necessários, e do agendamento; o painel lateral separa planejado/confirmado/concluído.
- **Finalizado:** depende de encerramento oficial, produção e instalação efetivamente concluídas.

**Regras técnicas:** uma posição principal por venda/obra, mais **pendências paralelas** com percentual separado por categoria e tipo (separado, comprado, recebido). As atualizações de compras de vidro devem ser refletidas em todas as colunas, inclusive Produção. Nunca considerar «feito o pedido» equivalente a «recebido». Os percentuais deverão usar quantidades/unidades compatíveis, jamais meramente contar linhas do banco. Materiais sem quantitativo confiável exibem «Não apurado». Nenhuma coluna visual altera ordens ou dispensas técnicas no Cliente 360.

## Decisão de desenho — Aguardando Material como coluna própria (24/10/2026)

A pedido de Francis, **incluir a coluna visual «Aguardando Material»** entre **Compras** e **Medição Final**, formando a sequência compacta **Vendido → Separação de Materiais → Compras → Aguardando Material → Medição Final → Produção → Instalação → Finalizado** (oito colunas principais, ainda não homologadas). Esta decisão substitui a nota anterior que tratava «Aguardando materiais» somente como substatus: a coluna passa a existir, **mas a pendência também deve ser exibida como alerta paralelo quando o projeto estiver em outra fase**.

**Entradas e saídas verificáveis:**
- **Compras:** necessidade formal em cotação/aprovação/pedido. O evento de pedido emitido/compra confirmada, com ao menos um material necessário ainda não recebido, habilita «Aguardando Material», se não houver atividade principal mais avançada comprovada.
- **Aguardando Material:** mostrar «Pedido efetuado · aguardando entrega», fornecedor/ETA **somente se registrados**, itens por categoria (perfis/vidros/acessórios), quantidade comprada, recebida, faltante e prazos. Recebimento parcial fica na coluna com alerta específico de quantidades remanescentes; não considerar pedido comprado como recebido.
- **Saída de Aguardando Material:** a liberação real do material necessário (recebimento e/ou reserva de estoque oficial, conforme setor), mais os demais requisitos da próxima etapa, permite avanço. Recebimento não conclui medição e não autoriza automaticamente OP.
- **Compra do vidro após Medição Final:** quando a obra já estiver em Medição Final ou Produção, uma compra de vidro pendente deve aparecer como alerta destacado no mesmo card («Vidros comprados, aguardando entrega»), **sem duplicar card nem retroceder automaticamente a fase principal**. A situação por tipologia permite diferenciar peças liberadas e bloqueadas.
- **Exemplo de estado:** «Produção 60% · Vidros comprados 100% · Vidros recebidos 40% · Falta entrega de 6 unidades» (valores ilustrativos). Não confundir porcentagem comprada com recebida nem usar contagem de linhas como percentual de quantidade.

**Integração:** fontes de verdade em Compras/Recebimento/Estoque, Medição Final e Produção, vinculadas à venda e obra corretas do Cliente 360; o Kanban Geral continua de leitura. Renomear/reordenar coluna não altera vínculo; excluir redistribui critérios com confirmação Master, auditoria e sem perda de registros. **Ainda não alterar código em produção, migrações ou configuração real do cliente**. Implementar e testar em branch isolada, comparar com versão homologada e solicitar aprovação específica para produção.
