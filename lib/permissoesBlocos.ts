import type { Setor } from './tipos'

export type BlocoPermissaoId =
  | 'comercial'
  | 'financeiro'
  | 'clientes'
  | 'engenharia'
  | 'producao'
  | 'compras_estoque'
  | 'administracao'
  | 'conhecimento'
  | 'outros'

export type AcaoPermissao = {
  id: string
  label: string
  descricao: string
}

export type ItemPermissaoBloco = {
  id: string
  setorId: string
  label: string
  descricao: string
  bloco: BlocoPermissaoId
  escopo?: 'crm'
  acoes: AcaoPermissao[]
}

export type BlocoPermissaoUsuario = {
  id: BlocoPermissaoId
  label: string
  descricao: string
  itens: ItemPermissaoBloco[]
}

const a = (id:string,label:string,descricao:string):AcaoPermissao => ({id,label,descricao})
const m = (id:string,setorId:string,label:string,descricao:string,bloco:BlocoPermissaoId,acoes:AcaoPermissao[],escopo?:'crm'):ItemPermissaoBloco => ({id,setorId,label,descricao,bloco,acoes,escopo})

const BLOCOS:Array<Omit<BlocoPermissaoUsuario,'itens'>> = [
  {id:'comercial',label:'Comercial',descricao:'CRM, representantes, orçamento, contratos, comissões e balcão.'},
  {id:'financeiro',label:'Financeiro',descricao:'Financeiro geral, contas a pagar/receber, caixa, fiscal e relatórios.'},
  {id:'clientes',label:'Clientes e relacionamento',descricao:'Cliente, parceiros, pós-venda, assistência e marketing.'},
  {id:'engenharia',label:'Engenharia e técnico',descricao:'Projeto, MEE, medições, biblioteca técnica, modelagem e P&D.'},
  {id:'producao',label:'Produção e instalação',descricao:'Produção, medida final, qualidade, instalação e logística.'},
  {id:'compras_estoque',label:'Compras e estoque',descricao:'Cotações, pedidos, materiais, estoque e recebimento.'},
  {id:'administracao',label:'Administração',descricao:'Cadastros, configurações, RH, direção, consultoria e BI.'},
  {id:'conhecimento',label:'Conhecimento',descricao:'Universidade Atlas e conteúdo interno.'},
  {id:'outros',label:'Outros acessos',descricao:'Funcionalidades adicionais ainda não classificadas.'},
]

const MODULOS:ItemPermissaoBloco[] = [
  m('crm','crm','CRM e carteira comercial','Funil, tarefas, metas e oportunidades.','comercial',[
    a('comercial.crm.consultar','Consultar CRM','Ver funil, oportunidades, tarefas e histórico comercial.'),
    a('comercial.crm.cadastrar','Cadastrar oportunidade','Criar leads/oportunidades e iniciar atendimento.'),
    a('comercial.crm.editar','Editar oportunidade','Alterar dados, temperatura, etapa e responsável.'),
    a('comercial.crm.interacoes','Registrar interações','Registrar ligação, WhatsApp, visita, proposta e negociação.'),
    a('comercial.crm.tarefas','Gerenciar tarefas','Criar, editar e concluir tarefas comerciais.'),
    a('comercial.crm.metas','Gerenciar metas','Consultar e editar metas comerciais.'),
  ],'crm'),
  m('representantes','representantes','Representantes comerciais','Gestão de representantes e desempenho.','comercial',[
    a('comercial.representantes.consultar','Consultar representantes','Ver cadastro, contato e carteira.'),
    a('comercial.representantes.editar','Cadastrar/editar representantes','Criar e alterar cadastro de representantes.'),
    a('comercial.representantes.vendas','Consultar vendas','Ver vendas atribuídas ao representante.'),
    a('comercial.representantes.comissoes','Consultar comissões','Ver comissão e desempenho comercial.'),
  ]),
  m('pedido-orcamento','orcamentos','Pedido de orçamento','Pedidos enviados para orçamento.','comercial',[
    a('comercial.pedido_orcamento.consultar','Consultar pedidos','Ver pedidos de orçamento.'),
    a('comercial.pedido_orcamento.criar','Criar pedido','Cadastrar novo pedido de orçamento.'),
    a('comercial.pedido_orcamento.editar','Editar pedido','Alterar pedido antes da conclusão.'),
    a('comercial.pedido_orcamento.anexos','Gerenciar anexos','Adicionar ou remover fotos, projetos e documentos.'),
    a('comercial.pedido_orcamento.enviar','Enviar para orçamento','Encaminhar pedido para elaboração.'),
  ]),
  m('contratos','contratos','Contratos e documentos','Documentos comerciais e contratos da venda.','comercial',[
    a('comercial.contratos.consultar','Consultar contratos','Visualizar contratos e documentos.'),
    a('comercial.contratos.gerar','Gerar contrato','Gerar contrato a partir da venda.'),
    a('comercial.contratos.editar','Editar contrato','Alterar informações do contrato.'),
    a('comercial.contratos.documentos','Gerenciar documentos','Anexar, substituir e organizar documentos.'),
    a('comercial.contratos.validar','Validar contrato','Aprovar ou validar documentação comercial.'),
  ]),
  m('comissoes','comissoes','Comissões e RT','Comissões comerciais e responsabilidade técnica.','comercial',[
    a('comercial.comissoes.consultar','Consultar comissões/RT','Visualizar comissões e RT.'),
    a('comercial.comissoes.regras','Editar regras','Cadastrar percentuais e regras.'),
    a('comercial.comissoes.lancar','Lançar/ajustar comissão','Criar ou corrigir lançamentos.'),
    a('comercial.comissoes.aprovar','Aprovar comissão','Validar comissão para pagamento.'),
  ]),
  m('fazer-orcamento','fazer-orcamento-msanfyvj','Fazer orçamento','Elaboração e precificação do orçamento.','comercial',[
    a('comercial.orcamento.consultar','Consultar orçamento','Abrir orçamento e composição.'),
    a('comercial.orcamento.criar','Criar orçamento','Criar novo orçamento.'),
    a('comercial.orcamento.editar','Editar orçamento','Alterar tipologias, medidas e composição.'),
    a('comercial.orcamento.custos','Ver custos','Visualizar custos, sobra e composição técnica.'),
    a('comercial.orcamento.margem','Editar margem/preço','Alterar margem, sobra cobrada e preço.'),
    a('comercial.orcamento.pdf','Gerar PDF','Gerar e imprimir orçamento.'),
    a('comercial.orcamento.enviar','Enviar orçamento','Enviar proposta ao cliente/vendedor.'),
    a('comercial.orcamento.aprovar','Confirmar venda','Aprovar/confirmar orçamento vendido.'),
  ]),
  m('venda-balcao','venda-balcao','Venda balcão','PDV, orçamento balcão e consulta de preço.','comercial',[
    a('comercial.balcao.consultar_preco','Consultar preço','Consultar produtos e preços.'),
    a('comercial.balcao.orcamento','Criar orçamento balcão','Montar orçamento de balcão.'),
    a('comercial.balcao.vender','Finalizar venda','Concluir venda balcão.'),
    a('comercial.balcao.editar','Editar atendimento/venda','Alterar dados antes da finalização.'),
    a('comercial.balcao.cancelar','Cancelar/devolver','Cancelar venda ou registrar devolução.'),
    a('comercial.balcao.historico','Consultar histórico','Consultar vendas e atendimentos anteriores.'),
  ]),

  m('financeiro-geral','financeiro','Financeiro geral','Visão financeira consolidada e IA financeira.','financeiro',[
    a('financeiro.geral.consultar','Consulta financeira geral','Ver resumo e posição financeira.'),
    a('financeiro.ia.consultar','Acesso financeiro pela IA Atlas','Permitir que a IA consulte dados financeiros internos.'),
  ]),
  m('contas-pagar','financeiro','Contas a pagar','Cadastro, manutenção e baixa de despesas.','financeiro',[
    a('financeiro.contas_pagar.consultar','Consultar contas a pagar','Ver fornecedores, documentos, vencimentos e valores.'),
    a('financeiro.contas_pagar.cadastrar','Cadastrar conta a pagar','Criar nova conta/despesa.'),
    a('financeiro.contas_pagar.editar','Editar conta a pagar','Alterar vencimento, descrição e informações.'),
    a('financeiro.contas_pagar.pagar','Pagar / dar baixa','Registrar pagamento e forma de pagamento.'),
    a('financeiro.contas_pagar.reabrir','Reabrir conta','Reabrir uma conta paga/cancelada quando permitido.'),
    a('financeiro.contas_pagar.cancelar','Cancelar conta','Cancelar uma conta a pagar.'),
  ]),
  m('contas-receber','caixa-balcao','Contas a receber','Parcelas, recebimentos e recibos.','financeiro',[
    a('financeiro.contas_receber.consultar','Consultar contas a receber','Ver parcelas, vencimentos, valores e saldos.'),
    a('financeiro.contas_receber.cadastrar','Cadastrar conta a receber','Criar nova conta/parcelamento.'),
    a('financeiro.contas_receber.editar','Editar conta a receber','Alterar vencimento e dados da parcela.'),
    a('financeiro.contas_receber.receber','Receber / dar baixa','Registrar recebimento de uma parcela.'),
    a('financeiro.contas_receber.recibo','Gerar recibo','Gerar/imprimir comprovante de recebimento.'),
    a('financeiro.contas_receber.reabrir','Reabrir conta','Reabrir recebimento quando permitido.'),
    a('financeiro.contas_receber.cancelar','Cancelar conta','Cancelar uma conta a receber.'),
  ]),
  m('caixa','caixa-balcao','Caixa','Operações do caixa do balcão.','financeiro',[
    a('financeiro.caixa.consultar','Consultar caixa','Ver caixa aberto, movimentos e resumo.'),
    a('financeiro.caixa.abrir','Abrir caixa','Abrir um ponto de caixa.'),
    a('financeiro.caixa.receber','Receber no caixa','Registrar entradas decorrentes de recebimentos.'),
    a('financeiro.caixa.pagar','Pagar pelo caixa','Registrar saídas/pagamentos autorizados.'),
    a('financeiro.caixa.suprimento','Fazer suprimento','Adicionar dinheiro ao caixa.'),
    a('financeiro.caixa.sangria','Fazer sangria','Retirar dinheiro do caixa.'),
    a('financeiro.caixa.fechar','Fechar caixa','Conferir e fechar o caixa.'),
  ]),
  m('fiscal','fiscal','Faturamento e fiscal','Faturamento, notas e dados fiscais.','financeiro',[
    a('financeiro.fiscal.consultar','Consultar informações fiscais','Ver dados fiscais e situação de faturamento.'),
    a('financeiro.fiscal.notas_consultar','Consultar notas','Visualizar notas fiscais emitidas/recebidas.'),
    a('financeiro.fiscal.faturar','Faturar / emitir nota','Gerar faturamento e emissão fiscal quando integrado.'),
    a('financeiro.fiscal.editar','Editar dados fiscais','Alterar dados fiscais antes da emissão.'),
    a('financeiro.fiscal.cancelar','Cancelar nota','Solicitar/cancelar nota quando permitido.'),
  ]),
  m('relatorios-financeiros','relatorios-balcao','Relatórios financeiros do balcão','Indicadores, margens e relatórios.','financeiro',[
    a('financeiro.relatorios.indicadores','Consultar indicadores','Ver indicadores financeiros do balcão.'),
    a('financeiro.relatorios.margens','Consultar margens','Ver margens e rentabilidade.'),
    a('financeiro.relatorios.relatorio','Consultar relatórios','Abrir relatórios financeiros.'),
    a('financeiro.relatorios.exportar','Exportar relatórios','Exportar/imprimir dados gerenciais.'),
  ]),

  m('portal-cliente','portal-cliente','Portal do cliente','Dados e recursos do cliente.','clientes',[
    a('clientes.portal.basico','Consultar nome e contato','Ver identificação e contato do cliente.'),
    a('clientes.portal.completo','Consultar cadastro completo','Ver endereço, documentos e informações completas.'),
    a('clientes.portal.orcamentos','Consultar orçamentos/vendas','Ver histórico comercial do cliente.'),
    a('clientes.portal.obras','Consultar obras','Ver obras e andamento.'),
    a('clientes.portal.financeiro','Consultar financeiro','Ver posição financeira do cliente.'),
    a('clientes.portal.documentos','Consultar documentos','Ver documentos disponíveis no portal.'),
    a('clientes.portal.editar','Editar cadastro','Alterar dados do cliente.'),
  ]),
  m('portal-parceiros','portal-parceiros','Portal de parceiros','Arquitetos, engenheiros, construtoras e parceiros.','clientes',[
    a('clientes.parceiros.basico','Consultar nome e contato','Ver cadastro básico do parceiro.'),
    a('clientes.parceiros.editar','Cadastrar/editar parceiro','Alterar dados do parceiro.'),
    a('clientes.parceiros.vendas','Consultar vendas indicadas','Ver volume de vendas e indicações.'),
    a('clientes.parceiros.comissoes','Consultar RT/comissões','Ver valores e regras de RT/comissões.'),
    a('clientes.parceiros.oportunidades','Consultar oportunidades','Ver clientes/obras vinculados ao parceiro.'),
  ]),
  m('pos-venda','pos-venda','Pós-venda e garantia','Acompanhamento após a entrega.','clientes',[
    a('clientes.pos_venda.consultar','Consultar pós-venda','Ver registros e situação.'),
    a('clientes.pos_venda.criar','Abrir pós-venda','Criar novo acompanhamento/chamado.'),
    a('clientes.pos_venda.editar','Editar pós-venda','Alterar dados e andamento.'),
    a('clientes.pos_venda.garantia','Gerenciar garantia','Registrar e validar informações de garantia.'),
    a('clientes.pos_venda.concluir','Concluir pós-venda','Encerrar atendimento.'),
  ]),
  m('assistencia-abrir','assistencia-abrir','Abrir assistência','Criação de chamados de assistência.','clientes',[
    a('clientes.assistencia.abrir','Abrir assistência','Criar novo chamado.'),
    a('clientes.assistencia.anexos','Adicionar anexos','Incluir fotos, vídeos e documentos.'),
  ]),
  m('assistencia-painel','assistencia-painel','Painel de assistências','Gestão dos chamados.','clientes',[
    a('clientes.assistencia.consultar','Consultar assistências','Ver chamados e histórico.'),
    a('clientes.assistencia.editar','Editar assistência','Alterar dados e responsável.'),
    a('clientes.assistencia.agendar','Agendar atendimento','Programar visita/execução.'),
    a('clientes.assistencia.status','Alterar status','Mover andamento do chamado.'),
    a('clientes.assistencia.concluir','Concluir assistência','Encerrar chamado.'),
  ]),
  m('marketing','marketing','Marketing','Campanhas, contatos e geração de demanda.','clientes',[
    a('clientes.marketing.consultar','Consultar marketing','Ver campanhas e indicadores.'),
    a('clientes.marketing.campanhas','Criar/editar campanhas','Gerenciar campanhas.'),
    a('clientes.marketing.contatos','Consultar contatos','Acessar contatos liberados para marketing.'),
    a('clientes.marketing.exportar','Exportar contatos/dados','Exportar dados autorizados.'),
  ]),

  m('conferir-projeto','engenharia-projeto','Conferir projeto','Validação técnica do projeto vendido.','engenharia',[
    a('engenharia.projeto.consultar','Consultar projeto','Abrir projeto e dados técnicos.'),
    a('engenharia.projeto.editar','Editar projeto','Corrigir informações técnicas.'),
    a('engenharia.projeto.aprovar','Aprovar projeto','Liberar projeto para próxima etapa.'),
    a('engenharia.projeto.reprovar','Reprovar/devolver','Devolver projeto com pendências.'),
  ]),
  m('mee','mee','Motor de Engenharia (MEE)','Receitas, regras e cálculos técnicos.','engenharia',[
    a('engenharia.mee.consultar','Consultar MEE','Ver receitas e composição técnica.'),
    a('engenharia.mee.calcular','Executar cálculos','Executar cálculo técnico.'),
    a('engenharia.mee.editar','Editar receitas/regras','Alterar receitas e regras técnicas.'),
    a('engenharia.mee.publicar','Publicar regra técnica','Validar/publicar regra oficial.'),
  ]),
  m('medicoes','medicao','Visitas técnicas e medições','Medições preliminares e visitas técnicas.','engenharia',[
    a('engenharia.medicao.consultar','Consultar medições','Ver medições e visitas.'),
    a('engenharia.medicao.criar','Registrar medição','Criar nova medição/visita.'),
    a('engenharia.medicao.editar','Editar medição','Alterar medidas e informações.'),
    a('engenharia.medicao.aprovar','Aprovar medição','Validar medição para sequência.'),
  ]),
  m('engenharia-geral','engenharia','Engenharia e projetos','Recursos gerais de engenharia.','engenharia',[
    a('engenharia.geral.consultar','Consultar engenharia','Ver projetos e indicadores técnicos.'),
    a('engenharia.geral.editar','Editar engenharia','Alterar informações do fluxo técnico.'),
  ]),
  m('modelagem-3d','modelagem-3d','Modelagem 3D','Projetos e modelos tridimensionais.','engenharia',[
    a('engenharia.modelagem.consultar','Consultar modelos','Visualizar arquivos/modelos.'),
    a('engenharia.modelagem.editar','Criar/editar modelos','Criar e alterar modelagem.'),
  ]),
  m('biblioteca-tecnica','biblioteca-tecnica','Biblioteca técnica','Documentos, padrões e conhecimento técnico.','engenharia',[
    a('engenharia.biblioteca.consultar','Consultar biblioteca','Pesquisar documentos técnicos.'),
    a('engenharia.biblioteca.adicionar','Adicionar conteúdo','Enviar novo conteúdo técnico.'),
    a('engenharia.biblioteca.editar','Editar conteúdo','Alterar conteúdo existente.'),
    a('engenharia.biblioteca.validar','Validar conteúdo','Aprovar conhecimento oficial.'),
  ]),
  m('ped','ped','Pesquisa e desenvolvimento','Desenvolvimento e melhoria técnica.','engenharia',[
    a('engenharia.ped.consultar','Consultar P&D','Ver projetos e estudos.'),
    a('engenharia.ped.criar','Criar projeto/estudo','Abrir novo trabalho de P&D.'),
    a('engenharia.ped.editar','Editar P&D','Alterar estudos e documentação.'),
    a('engenharia.ped.aprovar','Aprovar resultado','Validar solução desenvolvida.'),
  ]),

  m('producao','producao','Produção','Kanban, ordens e execução fabril.','producao',[
    a('producao.geral.consultar','Consultar produção','Ver Kanban e ordens.'),
    a('producao.geral.mover','Mover etapas','Alterar status/etapa da produção.'),
    a('producao.geral.editar','Editar ordem','Alterar informações da ordem.'),
    a('producao.plano_corte.consultar','Consultar plano de corte','Ver lista/plano de corte.'),
    a('producao.plano_corte.gerar','Gerar plano de corte','Gerar/recalcular plano.'),
    a('producao.imprimir','Imprimir documentos','Gerar fichas e listas para fábrica.'),
  ]),
  m('medida-final','medida-final-msdwtt9y','Medida final','Medição oficial antes da produção.','producao',[
    a('producao.medida_final.consultar','Consultar medida final','Ver medidas e conferência.'),
    a('producao.medida_final.preencher','Preencher medida final','Registrar medidas, fotos e campos.'),
    a('producao.medida_final.editar','Editar medida final','Corrigir dados ainda liberados.'),
    a('producao.medida_final.aprovar','Aprovar medida final','Confirmar e liberar para produção.'),
    a('producao.medida_final.remover_item','Remover item da Medição Final','Remover da medição um item não medido, com motivo e histórico.'),
    a('producao.medida_final.links','Gerar link externo','Criar/revogar acesso externo de medição.'),
  ]),
  m('qualidade','qualidade','Qualidade','Inspeções e controle de qualidade.','producao',[
    a('producao.qualidade.consultar','Consultar qualidade','Ver inspeções e ocorrências.'),
    a('producao.qualidade.registrar','Registrar inspeção','Criar checklist/inspeção.'),
    a('producao.qualidade.aprovar','Aprovar/reprovar','Validar ou reprovar item.'),
  ]),
  m('instalacao','instalacao','Instalação','Agenda, execução e conclusão da instalação.','producao',[
    a('producao.instalacao.consultar','Consultar instalação','Ver agenda e obras.'),
    a('producao.instalacao.agendar','Agendar instalação','Definir equipe e data.'),
    a('producao.instalacao.editar','Editar instalação','Alterar dados/agenda.'),
    a('producao.instalacao.checklist','Preencher checklist','Executar checklist de campo.'),
    a('producao.instalacao.concluir','Concluir instalação','Finalizar instalação.'),
  ]),
  m('logistica','logistica','Logística e entregas','Expedição, entrega e movimentações.','producao',[
    a('producao.logistica.consultar','Consultar logística','Ver entregas e movimentações.'),
    a('producao.logistica.planejar','Planejar entrega','Criar rota/agendamento.'),
    a('producao.logistica.status','Atualizar status','Registrar saída, entrega e ocorrência.'),
  ]),

  m('compras','compras','Compras','Necessidades, cotações e pedidos de compra.','compras_estoque',[
    a('compras.geral.consultar','Consultar compras','Ver necessidades, cotações e pedidos.'),
    a('compras.geral.solicitar','Criar solicitação','Abrir necessidade/pedido de compra.'),
    a('compras.geral.cotar','Fazer cotação','Registrar propostas de fornecedores.'),
    a('compras.geral.aprovar','Aprovar compra','Autorizar pedido de compra.'),
    a('compras.geral.comprar','Confirmar compra','Efetivar pedido ao fornecedor.'),
    a('compras.geral.cancelar','Cancelar compra','Cancelar solicitação/pedido.'),
    a('compras.notas.consultar','Consultar notas de entrada','Ver notas recebidas.'),
    a('compras.notas.lancar','Lançar nota de entrada','Importar/cadastrar NF de entrada.'),
  ]),
  m('compras-perfis','compras-perfis','Perfis','Compras de perfis por obra.','compras_estoque',[
    a('compras.perfis.consultar','Consultar perfis','Ver necessidades de perfis.'),
    a('compras.perfis.cotar','Cotar perfis','Registrar cotação.'),
    a('compras.perfis.comprar','Comprar perfis','Confirmar compra.'),
  ]),
  m('compras-acessorios','compras-acessorios','Acessórios','Compras de acessórios por obra.','compras_estoque',[
    a('compras.acessorios.consultar','Consultar acessórios','Ver necessidades.'),
    a('compras.acessorios.cotar','Cotar acessórios','Registrar cotação.'),
    a('compras.acessorios.comprar','Comprar acessórios','Confirmar compra.'),
  ]),
  m('compras-vidros','compras-vidros','Vidros','Compras de vidros por obra.','compras_estoque',[
    a('compras.vidros.consultar','Consultar vidros','Ver necessidades.'),
    a('compras.vidros.cotar','Cotar vidros','Registrar cotação.'),
    a('compras.vidros.comprar','Comprar vidros','Confirmar compra.'),
  ]),
  m('compras-outros','compras-outros','Outros materiais','Demais materiais da obra.','compras_estoque',[
    a('compras.outros.consultar','Consultar materiais','Ver necessidades.'),
    a('compras.outros.cotar','Cotar materiais','Registrar cotação.'),
    a('compras.outros.comprar','Comprar materiais','Confirmar compra.'),
  ]),
  m('estoque','estoque','Estoque','Saldos, movimentações, ajustes e reservas.','compras_estoque',[
    a('estoque.consultar','Consultar estoque','Ver saldo, local e disponibilidade.'),
    a('estoque.entrada','Registrar entrada','Lançar entrada autorizada.'),
    a('estoque.saida','Registrar saída','Lançar saída autorizada.'),
    a('estoque.ajustar','Ajustar/regular estoque','Fazer acerto de saldo/inventário.'),
    a('estoque.transferir','Transferir estoque','Mover material entre locais/unidades.'),
    a('estoque.reservar','Reservar material','Criar/editar reserva por obra.'),
    a('estoque.enderecar','Endereçar material','Definir endereço físico do produto.'),
  ]),
  m('recebimento','recebimento','Recebimento de mercadorias','Conferência física de materiais.','compras_estoque',[
    a('compras.recebimento.consultar','Consultar recebimentos','Ver notas e recebimentos pendentes.'),
    a('compras.recebimento.receber','Registrar recebimento','Confirmar chegada de mercadoria.'),
    a('compras.recebimento.conferir','Conferir itens','Registrar quantidades e condições.'),
    a('compras.recebimento.divergencia','Registrar divergência','Informar falta, excesso ou avaria.'),
  ]),

  m('cadastros','cadastro','Cadastros técnicos','Linhas, cores, materiais, produtos e fornecedores.','administracao',[
    a('admin.cadastros.consultar','Consultar cadastros','Ver cadastros técnicos.'),
    a('admin.cadastros.linhas','Editar linhas/tipologias','Criar e alterar linhas/tipologias.'),
    a('admin.cadastros.cores','Editar cores','Criar e alterar cores.'),
    a('admin.cadastros.materiais','Editar materiais','Criar e alterar materiais/preços.'),
    a('admin.cadastros.produtos','Editar produtos','Criar e alterar produtos.'),
    a('admin.cadastros.fornecedores','Editar fornecedores','Criar e alterar fornecedores.'),
  ]),
  m('configuracoes','configuracoes','Configurações do Atlas','Governança e configurações gerais.','administracao',[
    a('admin.config.consultar','Consultar configurações','Ver configurações do sistema.'),
    a('admin.config.empresa','Editar empresa','Alterar dados e identidade da empresa.'),
    a('admin.config.usuarios','Gerenciar usuários e acessos','Criar usuários e alterar permissões.'),
    a('admin.config.integracoes','Gerenciar integrações','Configurar W.Vetro, WhatsApp e outras integrações.'),
    a('admin.config.orcamento','Configurar orçamento','Margens, regras e parâmetros comerciais.'),
    a('admin.config.campos','Configurar campos','Criar/alterar campos parametrizáveis.'),
  ]),
  m('automacoes','workflow-automacoes','Automações do fluxo','Gatilhos, responsáveis e notificações.','administracao',[
    a('admin.automacoes.consultar','Consultar automações','Ver regras existentes.'),
    a('admin.automacoes.editar','Criar/editar automações','Alterar gatilhos e ações.'),
    a('admin.automacoes.ativar','Ativar/desativar','Ligar ou desligar automações.'),
  ]),
  m('rh','rh','Recursos Humanos','Gestão de colaboradores e rotinas de pessoal.','administracao',[
    a('rh.colaboradores.consultar','Consultar colaboradores','Ver cadastro funcional.'),
    a('rh.colaboradores.editar','Cadastrar/editar colaboradores','Alterar cadastro funcional.'),
    a('rh.holerites.consultar','Consultar holerites','Ver holerites autorizados.'),
    a('rh.holerites.gerenciar','Gerenciar holerites','Enviar/organizar holerites.'),
    a('rh.ponto.consultar','Consultar cartão de ponto','Ver registros de ponto.'),
    a('rh.ponto.editar','Ajustar cartão de ponto','Corrigir/validar marcações.'),
    a('rh.banco_horas.consultar','Consultar banco de horas','Ver saldo e movimentações.'),
    a('rh.banco_horas.editar','Ajustar banco de horas','Lançar/ajustar saldo.'),
    a('rh.beneficios.consultar','Consultar benefícios','Ver VA, prêmios e demais benefícios.'),
    a('rh.beneficios.editar','Gerenciar benefícios','Cadastrar/alterar benefícios.'),
    a('rh.ferias.consultar','Consultar férias','Ver períodos e programação.'),
    a('rh.ferias.editar','Programar férias','Criar/alterar programação.'),
    a('rh.admissoes','Admissões','Gerenciar admissão e documentos.'),
    a('rh.desligamentos','Desligamentos','Gerenciar desligamento e checklist.'),
    a('rh.documentos','Documentos do colaborador','Consultar/gerenciar documentos de RH.'),
    a('rh.relatorios','Relatórios de RH','Consultar/exportar indicadores de pessoal.'),
  ]),
  m('direcao','direcao','Direção e administração','Visão executiva e decisões administrativas.','administracao',[
    a('admin.direcao.dashboard','Consultar dashboard executivo','Ver indicadores executivos.'),
    a('admin.direcao.financeiro','Consultar indicadores financeiros','Ver visão financeira gerencial.'),
    a('admin.direcao.operacao','Consultar operação','Ver indicadores de produção/instalação.'),
    a('admin.direcao.aprovar','Aprovações de direção','Executar aprovações reservadas.'),
  ]),
  m('consultoria','consultoria','Consultoria e inteligência de gestão','Análises e planos de melhoria.','administracao',[
    a('consultoria.indicadores','Consultar indicadores','Ver indicadores consolidados.'),
    a('consultoria.analises','Criar/consultar análises','Registrar e visualizar análises gerenciais.'),
    a('consultoria.relatorios','Relatórios de consultoria','Criar/consultar relatórios.'),
    a('consultoria.recomendacoes','Recomendações e plano de ação','Criar e acompanhar recomendações.'),
    a('consultoria.acompanhamentos','Acompanhamentos','Registrar evolução e reuniões.'),
  ]),
  m('bi','relatorios','Relatórios e BI','Relatórios consolidados e inteligência de dados.','administracao',[
    a('admin.bi.consultar','Consultar BI','Ver relatórios e dashboards.'),
    a('admin.bi.exportar','Exportar dados','Exportar relatórios autorizados.'),
    a('admin.bi.criar','Criar relatório','Criar ou configurar relatório gerencial.'),
  ]),

  m('universidade','universidade','Universidade Atlas','Treinamento e conhecimento interno.','conhecimento',[
    a('conhecimento.universidade.consultar','Consultar conteúdos','Acessar treinamentos.'),
    a('conhecimento.universidade.progresso','Ver progresso','Consultar progresso dos usuários.'),
    a('conhecimento.universidade.editar','Criar/editar conteúdo','Gerenciar treinamentos.'),
    a('conhecimento.universidade.publicar','Publicar conteúdo','Validar/publicar material.'),
  ]),
]

export function montarBlocosPermissao(setores:Setor[]):BlocoPermissaoUsuario[] {
  const ids = new Set(setores.map(s=>s.id))
  const conhecidos = new Set(MODULOS.map(m=>m.setorId))
  const fallback:ItemPermissaoBloco[] = setores
    .filter(s=>!conhecidos.has(s.id))
    .map(s=>m(
      `outro-${s.id}`,s.id,s.nome,s.descricao||'Acesso ao setor no Atlas.','outros',
      [a(`outros.${s.id}.consultar`,'Consultar',`Consultar ${s.nome}.`),a(`outros.${s.id}.editar`,'Editar',`Editar ${s.nome}.`)]
    ))

  const modulos = [...MODULOS.filter(m=>ids.has(m.setorId)),...fallback]
  return BLOCOS.map(bloco=>({...bloco,itens:modulos.filter(m=>m.bloco===bloco.id)})).filter(b=>b.itens.length>0)
}

export function todasAcoesPermissao(setores:Setor[]) {
  return montarBlocosPermissao(setores).flatMap(b=>b.itens.flatMap(m=>m.acoes.map(acao=>({...acao,setorId:m.setorId,moduloId:m.id,blocoId:b.id}))))
}