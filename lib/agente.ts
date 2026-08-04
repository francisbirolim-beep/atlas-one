import { supabaseAdmin } from './supabaseAdmin'
import { gerarProximasOcorrencias } from './recorrencia'
import { chamarProvider } from './ai/providerManager'
import { carregarConfigAgente } from './ai/agentManager'
import { registrarUsoIA } from './ai/auditoria'

export const ACTION_TOOLS = ['propor_criar_tarefa', 'propor_criar_evento', 'propor_editar_arquivo_codigo']

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
    description: 'Somente para o usuario master. Propoe criar ou substituir o conteudo de um arquivo do codigo-fonte do sistema. NAO aplica direto: o usuario confirma antes. Apos confirmar, o commit e feito no GitHub e o deploy acontece automaticamente. Use ler_arquivo_codigo antes para ver o conteudo atual do arquivo, e sempre proponha o conteudo COMPLETO e final do arquivo, nao apenas o trecho alterado.',
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

export async function executarFerramenta(nome: string, input: any, usuarioId: string, usuarioRole: string): Promise<any> {
  const limite = Math.min(Number(input && input.limite) || 20, 50)
  try {
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
    if (nome === 'lembrar_fato') {
      const fato = input && input.fato
      if (!fato) return { erro: 'fato vazio' }
      await supabaseAdmin.from('agente_memorias').insert({ usuario_id: usuarioId, chave: 'fato', valor: fato })
      return { ok: true, salvo: fato }
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

export async function commitArquivoCodigo(caminho: string, novoConteudo: string, mensagem: string): Promise<any> {
  if (!process.env.GITHUB_PAT) return { erro: 'GITHUB_PAT nao configurado no servidor' }
  if (!novoConteudo || typeof novoConteudo !== 'string') return { erro: 'Conteudo do arquivo veio vazio ou incompleto (resposta da IA truncada). Peca uma mudanca menor, em um arquivo por vez.' }
  const headers = githubHeaders()
  let sha: string | undefined
  const getResp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + caminho, { headers })
  if (getResp.ok) {
    const getData = await getResp.json()
    sha = getData.sha
  }
  const body: any = {
    message: mensagem || 'Alteracao via Agente IA',
    content: Buffer.from(novoConteudo, 'utf-8').toString('base64'),
    branch: 'main',
  }
  if (sha) body.sha = sha
  const putResp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + caminho, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!putResp.ok) {
    const errText = await putResp.text()
    return { erro: 'Falha ao commitar (' + putResp.status + '): ' + errText.slice(0, 300) }
  }
  const putData = await putResp.json()
  return { ok: true, commitSha: putData.commit ? putData.commit.sha : null }
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
  prompt += 'REGRA MAIS IMPORTANTE: voce SO responde sobre o sistema Atlas One (dados internos da empresa: tarefas, orcamentos, assistencias, clientes/CRM, calendario, setores). Se perguntarem qualquer coisa fora disso (conhecimento geral, noticias, outros assuntos), recuse educadamente em uma frase curta e redirecione para o que voce pode ajudar no sistema. Nao gaste tempo nem tokens respondendo perguntas fora do escopo.\n'
  if (usuarioRole === 'master') {
    prompt += 'Este usuario e o administrador master: voce tem acesso total a todos os setores do sistema, sem restricao. Alem disso, voce pode ler e propor alteracoes no proprio codigo-fonte do sistema Atlas One usando as ferramentas ler_arquivo_codigo, listar_arquivos_codigo e propor_editar_arquivo_codigo. TODA alteracao de codigo deve ser proposta com propor_editar_arquivo_codigo (nunca aplicada direto) e so acontece apos o usuario confirmar explicitamente. Ao propor uma alteracao de codigo, explique em poucas palavras o que vai mudar e por que.\n'
  } else if (setoresInfo && setoresInfo.length > 0) {
    prompt += 'Voce e especialista SOMENTE nos setores que este usuario tem acesso, listados abaixo. Se perguntarem sobre outro setor do sistema que nao esta nessa lista, informe que voce so pode ajudar com os setores abaixo e sugira falar com o administrador para liberar acesso.\n'
    for (const s of setoresInfo) {
      prompt += '- Setor: ' + s.nome + (s.instrucoes_ia ? ('. Instrucoes especificas: ' + s.instrucoes_ia) : '') + '\n'
    }
  } else {
    prompt += 'Este usuario ainda nao tem setores liberados. Informe que ele deve pedir ao administrador para liberar acesso a algum setor.\n'
  }
  prompt += 'Use as ferramentas de busca para responder com dados reais, nunca invente numeros, nomes ou datas.\n'
  prompt += 'Quando o usuario pedir algo que muda dados (criar tarefa, criar evento, editar codigo), use a ferramenta propor_* sozinha nessa resposta. O sistema vai pedir confirmacao ao usuario antes de executar de verdade. Nunca diga que ja fez algo que so foi proposto.\n'
  prompt += 'Se perceber uma preferencia clara e util do usuario, ou se ele pedir para voce lembrar de algo, guarde com lembrar_fato.\n'
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
  const { data: memoriasData } = await supabaseAdmin
    .from('agente_memorias')
    .select('valor')
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
    const respostaIA = await chamarProvider(configAgente.provider, {
      apiKey,
      model: configAgente.modelo,
      maxTokens: configAgente.maxTokens,
      system,
      messages: msgs,
      tools: (usuarioRole === 'master' ? [...TOOLS, ...MASTER_TOOLS] : TOOLS),
    })
    if (!respostaIA.ok) {
      await registrarUsoIA({ agenteId: configAgente.id, usuarioId, usuarioNome, provider: configAgente.provider, modelo: configAgente.modelo, passos: i + 1, sucesso: false, erro: respostaIA.erro })
      return { done: true, text: 'Nao consegui falar com a IA agora (erro ' + (respostaIA.status || '?') + '): ' + (respostaIA.erro || ''), erro: true, messages: msgs, detalhe: respostaIA.erro }
    }
    const data = respostaIA.data
    const blocks = data.content || []
    const toolUses = blocks.filter((b: any) => b.type === 'tool_use')
    msgs = [...msgs, { role: 'assistant', content: blocks }]

    if (toolUses.length === 0) {
      const texto = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      await registrarUsoIA({ agenteId: configAgente.id, usuarioId, usuarioNome, provider: configAgente.provider, modelo: configAgente.modelo, passos: i + 1, sucesso: true })
      return { done: true, text: texto, messages: msgs }
    }

    const acao = toolUses.find((t: any) => ACTION_TOOLS.indexOf(t.name) !== -1)
    if (acao) {
      const texto = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      return { done: false, text: texto, pendingAction: { toolUseId: acao.id, name: acao.name, input: acao.input }, messages: msgs }
    }

    const toolResults = []
    for (const t of toolUses) {
      const resultado = await executarFerramenta(t.name, t.input, usuarioId, usuarioRole)
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
  return usuario || null
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
