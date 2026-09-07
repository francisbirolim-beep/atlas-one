import { supabaseAdmin } from './supabaseAdmin'
import { gerarProximasOcorrencias } from './recorrencia'
import { chamarProvider } from './ai/providerManager'
import { carregarConfigAgente } from './ai/agentManager'
import { registrarUsoIA } from './ai/auditoria'
import { estimarCustoUSD } from './ai/custo'
import { buscarBaseTecnicaAgente, validarConhecimentoTecnicoAgente } from './ai/baseTecnicaAgente'

export const ACTION_TOOLS = ['propor_criar_tarefa', 'propor_criar_evento', 'propor_editar_arquivo_codigo']

const EMPRESA_PADRAO = 'Atlas One'

export const TOOLS = [
  {
    name: 'buscar_tarefas',
    description: 'Busca as tarefas pessoais do usuario atual no kanban de tarefas. Use para responder perguntas sobre tarefas, prazos e tarefas recorrentes.',
    input_schema: {
      type: 'object',
      properties: {
        somente_pendentes: { type: 'boolean', description: 'Se true, so retorna tarefas nao concluidas' },
        limite: { type: 'number', description: 'Numero maximo de resultados, padrao 20' },
      },
    },
  },
  {
    name: 'buscar_eventos',
    description: 'Busca eventos do calendario pessoal do usuario atual.',
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'number', description: 'Numero maximo de resultados, padrao 20' } },
    },
  },
  {
    name: 'buscar_orcamentos',
    description: 'Busca orcamentos no kanban de orcamentos. Pode filtrar por nome do cliente ou temperatura do lead (quente, morno, frio).',
    input_schema: {
      type: 'object',
      properties: {
        busca_cliente: { type: 'string', description: 'Parte do nome do cliente para filtrar' },
        temperatura: { type: 'string', description: 'quente, morno ou frio' },
        limite: { type: 'number', description: 'Numero maximo de resultados, padrao 20' },
      },
    },
  },
  {
    name: 'buscar_clientes',
    description: 'Busca clientes cadastrados no CRM pelo nome.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Parte do nome do cliente' },
        limite: { type: 'number', description: 'Numero maximo de resultados, padrao 20' },
      },
    },
  },
  {
    name: 'buscar_assistencias',
    description: 'Busca chamados de assistencia tecnica, opcionalmente filtrando por status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status do chamado' },
        limite: { type: 'number', description: 'Numero maximo de resultados, padrao 20' },
      },
    },
  },
  {
    name: 'buscar_setores',
    description: 'Lista os setores/areas ativos do sistema Atlas One.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'buscar_base_tecnica',
    description: 'Pesquisa a base tecnica real do Atlas: perfis, acessorios, vidros, produtos e linhas. Use SEMPRE para perguntas tecnicas como "trilho de 3 planos da Suprema", "perfil mao de amigo", codigos e aplicacoes. Conhecimento validado pelo usuario tem prioridade; sem validacao, apresente apenas como candidato e nunca como certeza.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Descricao livre do que procurar, por exemplo: trilho 3 planos' },
        linha: { type: 'string', description: 'Linha tecnica quando conhecida, por exemplo: Suprema' },
        categoria: { type: 'string', description: 'perfil, acessorio, vidro ou outra categoria, opcional' },
        limite: { type: 'number', description: 'Numero maximo de candidatos, padrao 8' },
      },
      required: ['busca'],
    },
  },
  {
    name: 'lembrar_fato',
    description: 'Salva um fato ou preferencia sobre o usuario para lembrar em conversas futuras (aprendizado continuo). Use quando o usuario pedir para voce lembrar algo, ou notar uma preferencia clara e recorrente.',
    input_schema: {
      type: 'object',
      properties: { fato: { type: 'string', description: 'O fato a lembrar, em uma frase curta e clara' } },
      required: ['fato'],
    },
  },
  {
    name: 'propor_criar_tarefa',
    description: 'Propoe a criacao de uma nova tarefa pessoal. NAO cria direto: o usuario confirma antes. Use esta ferramenta sozinha, sem combinar com outras, quando decidir propor a acao.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        descricao: { type: 'string' },
        data_hora: { type: 'string', description: 'Data e hora no formato ISO 8601, opcional' },
        recorrencia_tipo: { type: 'string', description: 'semanal, dia_util_mes ou dia_fixo_mes, opcional' },
        recorrencia_valor: { type: 'number', description: 'numero do dia util ou dia fixo do mes, se aplicavel' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'propor_criar_evento',
    description: 'Propoe a criacao de um novo evento no calendario. NAO cria direto: o usuario confirma antes. Use esta ferramenta sozinha quando decidir propor a acao.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        local: { type: 'string' },
        data_inicio: { type: 'string', description: 'Data e hora ISO 8601' },
        data_fim: { type: 'string', description: 'Data e hora ISO 8601, opcional' },
        recorrencia_tipo: { type: 'string', description: 'semanal, dia_util_mes ou dia_fixo_mes, opcional' },
        recorrencia_valor: { type: 'number' },
      },
      required: ['titulo', 'data_inicio'],
    },
  },
]

export const MASTER_TOOLS = [
  {
    name: 'validar_conhecimento_tecnico',
    description: 'Somente para o usuario master. Salva uma classificacao tecnica como conhecimento VALIDADO do Atlas quando o usuario confirmar ou corrigir explicitamente um item mostrado pela busca tecnica. Use para ensinar, por exemplo, que determinado codigo e trilho de 3 planos da Suprema. Nunca valide por inferencia propria.',
    input_schema: {
      type: 'object',
      properties: {
        produto_id: { type: 'string', description: 'ID do produto retornado por buscar_base_tecnica' },
        codigo: { type: 'string', description: 'Codigo do perfil/produto, alternativa ao produto_id' },
        tipo_perfil: { type: 'string', description: 'Classificacao: trilho, marco, montante, mao de amigo etc.' },
        numero_planos: { type: 'number', description: 'Numero de planos quando aplicavel: 2, 3, 5 etc.' },
        linha: { type: 'string', description: 'Linha tecnica validada, por exemplo Suprema' },
        aplicacao: { type: 'string', description: 'Aplicacao tecnica conhecida' },
        observacao: { type: 'string', description: 'Observacao tecnica do validador' },
        atributos: { type: 'object', description: 'Outros atributos tecnicos confirmados' },
      },
    },
  },
  {
    name: 'ler_arquivo_codigo',
    description: 'Somente para o usuario master. Le o conteudo de um arquivo do codigo-fonte do sistema Atlas One (repositorio no GitHub). Use para entender o codigo antes de propor uma alteracao.',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho do arquivo no repositorio, ex: lib/agente.ts' } },
      required: ['caminho'],
    },
  },
  {
    name: 'listar_arquivos_codigo',
    description: 'Somente para o usuario master. Lista arquivos e pastas dentro de um diretorio do repositorio do Atlas One.',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho da pasta no repositorio, vazio para a raiz' } },
    },
  },
  {
    name: 'propor_editar_arquivo_codigo',
    description: 'Somente para o usuario master. Propoe uma alteracao de codigo para revisao. A execucao direta permanece bloqueada: qualquer mudanca real exige branch, PR, CI e aprovacao.',
    input_schema: {
      type: 'object',
      properties: {
        caminho: { type: 'string', description: 'Caminho do arquivo no repositorio' },
        novo_conteudo: { type: 'string', description: 'Conteudo completo e final do arquivo apos a alteracao' },
        mensagem_commit: { type: 'string', description: 'Mensagem curta descrevendo a alteracao, em portugues' },
      },
      required: ['caminho', 'novo_conteudo', 'mensagem_commit'],
    },
  },
]

async function empresaDoUsuario(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('empresa_id')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error || !data?.empresa_id) return null
  return String(data.empresa_id)
}

export async function executarFerramenta(nome: string, input: any, usuarioId: string, usuarioRole: string, usuarioNome?: string): Promise<any> {
  const limite = Math.min(Number(input && input.limite) || 20, 50)
  try {
    const empresaId = await empresaDoUsuario(usuarioId)
    if (!empresaId) return { erro: 'Usuario sem empresa vinculada.' }

    if (nome === 'buscar_tarefas') {
      let q = supabaseAdmin
        .from('tarefas')
        .select('titulo,descricao,data_hora,concluida_em,recorrencia_tipo')
        .eq('usuario_id', usuarioId)
        .order('data_hora', { ascending: true })
        .limit(limite)
      if (input && input.somente_pendentes) q = q.is('concluida_em', null)
      const { data, error } = await q
      return error ? { erro: error.message } : { tarefas: data }
    }
    if (nome === 'buscar_eventos') {
      const { data, error } = await supabaseAdmin
        .from('eventos')
        .select('titulo,local,data_inicio,data_fim,recorrencia_tipo')
        .eq('usuario_id', usuarioId)
        .order('data_inicio', { ascending: true })
        .limit(limite)
      return error ? { erro: error.message } : { eventos: data }
    }
    if (nome === 'buscar_orcamentos') {
      let q = supabaseAdmin
        .from('orcamentos')
        .select('cliente_nome,tipo_esquadria,status,temperatura,valor_estimado,created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (input && input.busca_cliente) q = q.ilike('cliente_nome', '%' + input.busca_cliente + '%')
      if (input && input.temperatura) q = q.eq('temperatura', input.temperatura)
      const { data, error } = await q
      return error ? { erro: error.message } : { orcamentos: data }
    }
    if (nome === 'buscar_clientes') {
      let q = supabaseAdmin
        .from('clientes')
        .select('nome,whatsapp,cidade,origem,responsavel')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (input && input.busca) q = q.ilike('nome', '%' + input.busca + '%')
      const { data, error } = await q
      return error ? { erro: error.message } : { clientes: data }
    }
    if (nome === 'buscar_assistencias') {
      let q = supabaseAdmin
        .from('assistencias')
        .select('cliente_nome,descricao_problema,status,cidade,created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (input && input.status) q = q.eq('status', input.status)
      const { data, error } = await q
      return error ? { erro: error.message } : { assistencias: data }
    }
    if (nome === 'buscar_setores') {
      const { data, error } = await supabaseAdmin
        .from('setores')
        .select('nome,grupo,descricao')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      return error ? { erro: error.message } : { setores: data }
    }
    if (nome === 'buscar_base_tecnica') {
      return await buscarBaseTecnicaAgente(input, empresaId)
    }
    if (nome === 'validar_conhecimento_tecnico') {
      if (usuarioRole !== 'master') return { erro: 'Ferramenta disponivel apenas para o usuario master' }
      return await validarConhecimentoTecnicoAgente(input, usuarioId, usuarioNome || usuarioId, empresaId)
    }
    if (nome === 'lembrar_fato') {
      const fato = input && input.fato
      if (!fato) return { erro: 'fato vazio' }
      const { error } = await supabaseAdmin.from('agente_memorias').insert({ empresa_id: empresaId, usuario_id: usuarioId, chave: 'fato', valor: fato })
      return error ? { erro: error.message } : { ok: true, salvo: fato }
    }
    if (nome === 'ler_arquivo_codigo') {
      if (usuarioRole !== 'master') return { erro: 'Ferramenta disponivel apenas para o usuario master' }
      return await lerArquivoCodigo(input.caminho)
    }
    if (nome === 'listar_arquivos_codigo') {
      if (usuarioRole !== 'master') return { erro: 'Ferramenta disponivel apenas para o usuario master' }
      return await listarArquivosCodigo(input.caminho || '')
    }
    return { erro: 'ferramenta desconhecida' }
  } catch (e: any) {
    return { erro: String(e && e.message ? e.message : e) }
  }
}

const GITHUB_REPO = 'francisbirolim-beep/atlas-one'

function githubHeaders(): any {
  return {
    'Authorization': 'Bearer ' + process.env.GITHUB_PAT,
    'Accept': 'application/vnd.github+json',
  }
}

async function lerArquivoCodigo(caminho: string): Promise<any> {
  if (!process.env.GITHUB_PAT) return { erro: 'GITHUB_PAT nao configurado no servidor' }
  const resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + caminho, { headers: githubHeaders() })
  if (!resp.ok) return { erro: 'Nao encontrei o arquivo (' + resp.status + ')' }
  const data = await resp.json()
  if (Array.isArray(data)) return { erro: 'Isso e uma pasta, use listar_arquivos_codigo' }
  const conteudo = Buffer.from(data.content, 'base64').toString('utf-8')
  return { caminho, conteudo: conteudo.slice(0, 60000), truncado: conteudo.length > 60000 }
}

async function listarArquivosCodigo(caminho: string): Promise<any> {
  if (!process.env.GITHUB_PAT) return { erro: 'GITHUB_PAT nao configurado no servidor' }
  const resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + caminho, { headers: githubHeaders() })
  if (!resp.ok) return { erro: 'Nao encontrei a pasta (' + resp.status + ')' }
  const data = await resp.json()
  if (!Array.isArray(data)) return { erro: 'Isso e um arquivo, use ler_arquivo_codigo' }
  return { itens: data.map((i: any) => ({ nome: i.name, tipo: i.type, caminho: i.path })) }
}

export async function commitArquivoCodigo(_caminho: string, _novoConteudo: string, _mensagem: string): Promise<any> {
  return {
    erro: 'Alteracao direta de codigo pela IA esta bloqueada. Use branch, Pull Request, CI e aprovacao antes de qualquer merge.',
    bloqueado: true,
  }
}

export async function executarPropostaTarefa(usuarioId: string, input: any): Promise<any> {
  const { data: coluna } = await supabaseAdmin
    .from('tarefa_colunas')
    .select('id')
    .eq('usuario_id', usuarioId)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!coluna) return { erro: 'Nenhuma coluna de tarefas encontrada. Crie uma coluna no kanban de tarefas primeiro.' }
  const base = {
    usuario_id: usuarioId,
    coluna_id: coluna.id,
    titulo: input.titulo,
    descricao: input.descricao || null,
    data_hora: input.data_hora || null,
  }
  const { data: nova, error } = await supabaseAdmin.from('tarefas').insert(base).select().single()
  if (error) return { erro: error.message }
  if (input.recorrencia_tipo && input.data_hora) {
    await supabaseAdmin
      .from('tarefas')
      .update({ recorrencia_tipo: input.recorrencia_tipo, recorrencia_valor: input.recorrencia_valor || null })
      .eq('id', nova.id)
    const ocorrencias = gerarProximasOcorrencias(new Date(input.data_hora), input.recorrencia_tipo, input.recorrencia_valor || 1)
    if (ocorrencias.length > 0) {
      await supabaseAdmin.from('tarefas').insert(
        ocorrencias.map((d: any) => ({
          usuario_id: usuarioId,
          coluna_id: coluna.id,
          titulo: input.titulo,
          descricao: input.descricao || null,
          data_hora: d.toISOString(),
          regra_origem_id: nova.id,
        }))
      )
    }
  }
  return { ok: true, titulo: input.titulo, id: nova.id }
}

export async function executarPropostaEvento(usuarioId: string, input: any): Promise<any> {
  const base = {
    usuario_id: usuarioId,
    titulo: input.titulo,
    local: input.local || null,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim || null,
  }
  const { data: novo, error } = await supabaseAdmin.from('eventos').insert(base).select().single()
  if (error) return { erro: error.message }
  if (input.recorrencia_tipo) {
    await supabaseAdmin
      .from('eventos')
      .update({ recorrencia_tipo: input.recorrencia_tipo, recorrencia_valor: input.recorrencia_valor || null })
      .eq('id', novo.id)
    const ocorrencias = gerarProximasOcorrencias(new Date(input.data_inicio), input.recorrencia_tipo, input.recorrencia_valor || 1)
    if (ocorrencias.length > 0) {
      await supabaseAdmin.from('eventos').insert(
        ocorrencias.map((d: any) => ({
          usuario_id: usuarioId,
          titulo: input.titulo,
          local: input.local || null,
          data_inicio: d.toISOString(),
          data_fim: null,
          regra_origem_id: novo.id,
        }))
      )
    }
  }
  return { ok: true, titulo: input.titulo, id: novo.id }
}

function montarSystemPrompt(usuarioNome: string, usuarioRole: string, fatos: string[], setoresInfo: any[]): string {
  const hoje = new Date().toISOString().slice(0, 10)
  let prompt = 'Voce e o Agente IA do Atlas One, sistema interno da Esquadrifacio (esquadrias de aluminio e vidro).\n'
  prompt += 'Data de hoje: ' + hoje + '.\n'
  prompt += 'Usuario atual: ' + usuarioNome + ' (' + (usuarioRole === 'master' ? 'administrador' : 'funcionario') + ').\n'
  prompt += 'REGRA MAIS IMPORTANTE: voce SO responde sobre o sistema Atlas One e a base tecnica interna da Esquadrifacio: tarefas, orcamentos, assistencias, clientes/CRM, calendario, setores, linhas, perfis, acessorios, vidros, tipologias, medidas, formulacoes e demais dados tecnicos cadastrados. Se perguntarem qualquer coisa fora disso, recuse educadamente em uma frase curta e redirecione para o que voce pode ajudar no sistema.\n'
  if (usuarioRole === 'master') {
    prompt += 'Este usuario e o administrador master: voce tem acesso total a todos os setores do sistema. Pode ler arquivos do codigo-fonte para diagnostico, mas qualquer alteracao real exige branch, Pull Request, CI e aprovacao; commit direto em main e proibido.\n'
    prompt += 'Quando este usuario confirmar ou corrigir explicitamente uma classificacao tecnica de um perfil/produto mostrado por buscar_base_tecnica, use validar_conhecimento_tecnico para gravar esse conhecimento como VALIDADO. Exemplos: "esse e trilho de 3 planos", "na verdade e 2 planos", "esse e da linha Suprema". Nunca transforme sua propria inferencia em conhecimento validado.\n'
  } else if (setoresInfo && setoresInfo.length > 0) {
    prompt += 'Voce e especialista SOMENTE nos setores que este usuario tem acesso, listados abaixo. Se perguntarem sobre outro setor do sistema que nao esta nessa lista, informe que voce so pode ajudar com os setores abaixo e sugira falar com o administrador para liberar acesso.\n'
    for (const s of setoresInfo) {
      prompt += '- Setor: ' + s.nome + (s.instrucoes_ia ? ('. Instrucoes especificas: ' + s.instrucoes_ia) : '') + '\n'
    }
  } else {
    prompt += 'Este usuario ainda nao tem setores liberados. Informe que ele deve pedir ao administrador para liberar acesso a algum setor.\n'
  }
  prompt += 'Use as ferramentas de busca para responder com dados reais, nunca invente numeros, nomes, codigos, linhas ou datas.\n'
  prompt += 'Para qualquer pergunta sobre perfil, acessorio, vidro, linha, codigo, trilho, numero de planos, aplicacao ou outro conhecimento tecnico, use buscar_base_tecnica antes de responder. Se o resultado tiver conhecimento_validado, ele tem prioridade. Sem conhecimento validado, diga claramente que sao candidatos para validacao, nao uma certeza.\n'
  prompt += 'Quando o usuario pedir algo que muda dados (criar tarefa, criar evento, editar codigo), use a ferramenta propor_* sozinha nessa resposta. O sistema vai pedir confirmacao antes de executar. Nunca diga que ja fez algo que so foi proposto.\n'
  prompt += 'Se perceber uma preferencia clara e util do usuario, ou se ele pedir para voce lembrar de algo, guarde com lembrar_fato. Para conhecimento TECNICO de produto/perfil use validar_conhecimento_tecnico, nao lembrar_fato.\n'
  prompt += 'Responda sempre em portugues do Brasil, de forma direta e objetiva, sem enrolacao.\n'
  if (fatos && fatos.length > 0) {
    prompt += '\nO que voce ja sabe sobre este usuario (memoria de conversas anteriores):\n'
    prompt += fatos.map((f: any) => '- ' + f).join('\n')
  }
  return prompt
}

function sanitizarMensagens(mensagens: any[]): any[] {
  if (!Array.isArray(mensagens)) return []
  const resultado: any[] = []
  for (let i = 0; i < mensagens.length; i++) {
    const m = mensagens[i]
    resultado.push(m)
    if (m && m.role === 'assistant' && Array.isArray(m.content)) {
      const toolUses = m.content.filter((b: any) => b && b.type === 'tool_use')
      if (toolUses.length > 0) {
        const prox = mensagens[i + 1]
        const idsResolvidos = new Set(
          prox && prox.role === 'user' && Array.isArray(prox.content)
            ? prox.content.filter((b: any) => b && b.type === 'tool_result').map((b: any) => b.tool_use_id)
            : []
        )
        const pendentes = toolUses.filter((tu: any) => !idsResolvidos.has(tu.id))
        if (pendentes.length > 0) {
          resultado.push({
            role: 'user',
            content: pendentes.map((tu: any) => ({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({ ok: false, cancelado: true, motivo: 'Acao anterior nao foi confirmada nem cancelada; cancelada automaticamente para continuar a conversa.' }),
            })),
          })
        }
      }
    }
  }
  return resultado
}

export async function rodarLoop(messages: any[], usuarioId: string, usuarioNome: string, usuarioRole: string, apiKey: string): Promise<any> {
  const empresaId = await empresaDoUsuario(usuarioId)
  if (!empresaId) return { done: true, text: 'Usuario sem empresa vinculada.', erro: true, messages }

  const { data: memoriasData } = await supabaseAdmin
    .from('agente_memorias')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(30)
  const fatos = (memoriasData || []).map((m: any) => m.valor)
  let setoresInfo: any[] = []
  let setorIdPrincipal: string | null = null
  if (usuarioRole !== 'master') {
    const { data: permData } = await supabaseAdmin
      .from('permissoes')
      .select('setor_id')
      .eq('usuario_id', usuarioId)
    const setorIds = (permData || []).map((p: any) => p.setor_id)
    setorIdPrincipal = setorIds[0] || null
    if (setorIds.length > 0) {
      const { data: setoresData } = await supabaseAdmin
        .from('setores')
        .select('nome,instrucoes_ia')
        .in('id', setorIds)
      setoresInfo = setoresData || []
    }
  }
  const escopoAgente: 'setor' | 'master' = usuarioRole === 'master' ? 'master' : 'setor'
  const configAgente = await carregarConfigAgente(setorIdPrincipal, escopoAgente)
  const system = montarSystemPrompt(usuarioNome, usuarioRole, fatos, setoresInfo)

  let msgs = sanitizarMensagens(messages)
  const maxPassos = usuarioRole === 'master' ? 20 : 5
  for (let i = 0; i < maxPassos; i++) {
    const inicioChamada = Date.now()
    const respostaIA = await chamarProvider(configAgente.provider, {
      apiKey,
      model: configAgente.modelo,
      maxTokens: configAgente.maxTokens,
      system,
      messages: msgs,
      tools: (usuarioRole === 'master' ? [...TOOLS, ...MASTER_TOOLS] : TOOLS),
    })
    const duracaoMs = Date.now() - inicioChamada
    if (!respostaIA.ok) {
      await registrarUsoIA({ agenteId: configAgente.id, agenteNome: configAgente.nome, usuarioId, usuarioNome, empresa: EMPRESA_PADRAO, setorId: setorIdPrincipal, provider: configAgente.provider, modelo: configAgente.modelo, passos: i + 1, sucesso: false, erro: respostaIA.erro, duracaoMs, fallbackPolicy: 'configured_provider_only' })
      return { done: true, text: 'Nao consegui falar com a IA agora (erro ' + (respostaIA.status || '?') + '): ' + (respostaIA.erro || ''), erro: true, messages: msgs, detalhe: respostaIA.erro }
    }
    const data = respostaIA.data
    const blocks = data.content || []
    const toolUses = blocks.filter((b: any) => b.type === 'tool_use')
    msgs = [...msgs, { role: 'assistant', content: blocks }]

    if (toolUses.length === 0) {
      const texto = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      const tokensEntrada = data.usage ? data.usage.input_tokens : null
      const tokensSaida = data.usage ? data.usage.output_tokens : null
      const custoEstimado = estimarCustoUSD(configAgente.provider, configAgente.modelo, tokensEntrada, tokensSaida)
      await registrarUsoIA({ agenteId: configAgente.id, agenteNome: configAgente.nome, usuarioId, usuarioNome, empresa: EMPRESA_PADRAO, setorId: setorIdPrincipal, provider: configAgente.provider, modelo: configAgente.modelo, passos: i + 1, sucesso: true, tokensEntrada, tokensSaida, custoEstimado, duracaoMs, fallbackPolicy: 'configured_provider_only' })
      return { done: true, text: texto, messages: msgs }
    }

    const acao = toolUses.find((t: any) => ACTION_TOOLS.indexOf(t.name) !== -1)
    if (acao) {
      const texto = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      return { done: false, text: texto, pendingAction: { toolUseId: acao.id, name: acao.name, input: acao.input }, messages: msgs }
    }

    const toolResults = []
    for (const t of toolUses) {
      const resultado = await executarFerramenta(t.name, t.input, usuarioId, usuarioRole, usuarioNome)
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(resultado) })
    }
    msgs = [...msgs, { role: 'user', content: toolResults }]
  }
  return { done: true, text: 'Atingi o limite de passos para essa pergunta. Pode reformular de forma mais direta?', messages: msgs }
}

export async function verificarUsuario(authHeader: string | null): Promise<any> {
  const token = (authHeader || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !userData || !userData.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('*').eq('id', userData.user.id).maybeSingle()
  return usuario?.empresa_id ? usuario : null
}

export async function obterOuCriarConversaHoje(usuarioId: string): Promise<string | null> {
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)
  const { data: existente } = await supabaseAdmin
    .from('agente_conversas')
    .select('id')
    .eq('usuario_id', usuarioId)
    .gte('created_at', inicioHoje.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existente) return existente.id
  const { data: nova } = await supabaseAdmin.from('agente_conversas').insert({ usuario_id: usuarioId }).select('id').single()
  return nova ? nova.id : null
}

export async function salvarMensagem(conversaId: string | null, papel: string, conteudo: string): Promise<void> {
  if (!conversaId || !conteudo) return
  await supabaseAdmin.from('agente_mensagens').insert({ conversa_id: conversaId, papel, conteudo })
}
