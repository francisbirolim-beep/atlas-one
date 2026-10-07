import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro, type UsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { autenticarSchedulerWVetro } from '@/lib/wvetroSchedulerServer'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { nomeCadastroIncompleto, registrarPendenciaCadastro } from '@/lib/cadastroPendenciasServer'
import { normalizarCidadeMargem, resolverMargemOrcamentoPorCidade } from '@/lib/orcamentoMargensCidadeServer'
import { nomesClientesCompativeis, normalizarNomeClienteWVetro } from '@/lib/wvetroClienteIdentidade'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function obj(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null
}
function txt(...vs: unknown[]) {
  for (const v of vs) { const s = String(v ?? '').trim(); if (s) return s }
  return ''
}
function num(...vs: unknown[]) {
  for (const v of vs) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'number' && Number.isFinite(v)) return v
    let s = String(v).trim().replace(/[^0-9,.-]/g, '')
    if (!s) continue
    const temVirgula = s.includes(',')
    const temPonto = s.includes('.')
    if (temVirgula && temPonto) {
      // W.Vetro pode devolver número em pt-BR: 1.234,56.
      // O último separador define a casa decimal; os demais são milhares.
      const ultimaVirgula = s.lastIndexOf(',')
      const ultimoPonto = s.lastIndexOf('.')
      if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.')
      else s = s.replace(/,/g, '')
    } else if (temVirgula) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else if (temPonto) {
      const partes = s.split('.')
      if (partes.length > 2) s = partes.join('')
    }
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return 0
}
function norm(v: unknown) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}
function digitos(v: unknown) { return String(v ?? '').replace(/\D/g, '') }
function mm(v: unknown) {
  const n = num(v)
  if (n <= 0) return null
  return n > 0 && n < 20 ? Math.round(n * 1000) : Math.round(n)
}
function dataIso(v: unknown) {
  const s = txt(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
function arr(v: unknown): any[] { return Array.isArray(v) ? v : [] }

type RefTipologia = {
  id: string
  linha_raw: string
  modelo_raw: string
  tipologia_atlas_id: string | null
  imagem_url: string | null
}
type RefLinha = { linha_raw: string; linha_tecnica_id: string | null }

function nomeCliente(p: Record<string, any>) {
  return txt(p.PessoaNome, p.ClienteNome, p.NomeCliente, p.RazaoSocial, p.Nome, 'Cliente W.Vetro')
}
function telefoneCliente(p: Record<string, any>) {
  return txt(p.PessoaCelular, p.ClienteCelular, p.Celular, p.PessoaTelefone, p.Telefone)
}
function documentoCliente(p: Record<string, any>) {
  return txt(p.PessoaCPFCNPJ, p.ClienteCPFCNPJ, p.ClienteCNPJ, p.CPFCNPJ, p.CpfCnpj, p.Documento)
}

function itemWVetro(
  item: Record<string, any>,
  indice: number,
  refs: Map<string, RefTipologia>,
  linhas: Map<string, RefLinha>,
  tipologias: Map<string, any>,
) {
  const linhaRaw = txt(item.Linha, item.LinhaNome, item.LinhaDescricao)
  const modeloRaw = txt(item.Modelo, item.Nome, item.Descricao, item.Codigo)
  const ref = refs.get(`${norm(linhaRaw)}|${norm(modeloRaw)}`) || null
  const tipologia = ref?.tipologia_atlas_id ? tipologias.get(ref.tipologia_atlas_id) : null
  const linha = linhas.get(norm(linhaRaw)) || null
  const largura = mm(item.Largura ?? item.LarguraMM ?? item.LarguraMm)
  const altura = mm(item.Altura ?? item.AlturaMM ?? item.AlturaMm)
  const quantidade = Math.max(1, Math.round(num(item.Qtde, item.Quantidade, 1) || 1))
  const perfis = arr(item.Perfil).length ? arr(item.Perfil) : arr(item.Perfis)
  const acessorios = arr(item.Acessorios).length ? arr(item.Acessorios) : arr(item.Acessórios)
  const vidros = arr(item.Vidros)
  const vidro = obj(vidros[0])
  const cor = txt(item.Cor, item.CorNome, item.Acabamento)
  const folhasMatch = modeloRaw.match(/(\d+)\s*folhas?/i)
  const folhas = txt(item.Folhas, folhasMatch?.[1])
  const id = randomUUID()
  const precoTotal = num(item.ValorTotalAlterado, item.ValorTotal, item.Total)
  const precoUnit = num(item.ValorUnitario, item.ValorUnit, item.PrecoUnitario) || (precoTotal > 0 ? precoTotal / quantidade : 0)

  return {
    id,
    item_tipo: 'sob_medida',
    material_categoria: null,
    material_unidade: null,
    produto_nome: null,
    contramarco: txt(item.Contramarco) || null,
    ambiente: txt(item.Ambiente) || null,
    tipo_esquadria: tipologia?.chave || 'outro',
    tipo_outro_texto: tipologia ? null : (modeloRaw || null),
    folhas: folhas || null,
    tipo_medida: 'comum',
    largura_mm: largura,
    altura_mm: altura,
    quantidade,
    foto_url: null,
    foto_urls: null,
    descricao: txt(item.Descricao) || modeloRaw || undefined,
    observacao_tempera: null,
    observacao_producao: null,
    cor: cor || null,
    produto_id: null,
    preco_unit: precoUnit > 0 ? precoUnit : null,
    preco_total: precoTotal > 0 ? precoTotal : null,
    linha_id: linha?.linha_tecnica_id || null,
    linha_nome: linhaRaw || null,
    tipologia_id: ref?.tipologia_atlas_id || null,
    configuracao_preset_id: null,
    configuracao_nome: tipologia?.label || (modeloRaw ? `${modeloRaw}${linhaRaw ? ` (${linhaRaw})` : ''}` : null),
    configuracao_validada: false,
    modo_configuracao: 'assistido',
    configuracao_status: ref?.tipologia_atlas_id ? 'preenchida' : 'pendente',
    variaveis: {
      ...(folhas ? { folhas } : {}),
      ...(txt(vidro?.Especificacao, vidro?.Descricao) ? { vidro: txt(vidro?.Especificacao, vidro?.Descricao) } : {}),
      wvetro_importado: 'sim',
      wvetro_ordem: String(indice + 1),
    },
    referencia_wvetro: ref ? {
      referencia_id: ref.id,
      tipologia_id: ref.tipologia_atlas_id,
      linha: linhaRaw,
      modelo: modeloRaw,
      imagem_url: ref.imagem_url || null,
      utilizada_como_base: true,
      origem: 'orcamento_api',
    } : null,
    wvetro_item: item,
    wvetro_composicao: { perfis, acessorios, vidros },
  }
}

async function carregarContexto(empresaId: string) {
  const [refsR, linhasR, tipsR, clientesR, colunasR, orcR] = await Promise.all([
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url'),
    supabaseAdmin.from('wvetro_referencias_linhas').select('linha_raw,linha_tecnica_id'),
    supabaseAdmin.from('tipologias').select('id,chave,label'),
    supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj,whatsapp,telefone,email,cidade,endereco,bairro,cep,origem').eq('empresa_id', empresaId),
    supabaseAdmin.from('kanban_colunas').select('id,nome,ordem').order('ordem'),
    supabaseAdmin.from('orcamentos').select('id,cliente_id,obra_id,cidade,valor_estimado,itens,wvetro_fluxo,margem_padrao_pct,margem_padrao_origem,margem_regra_cidade_id,modo_entrada,coluna_id').eq('empresa_id', empresaId).or('modo_entrada.is.null,modo_entrada.neq.wvetro_api_vinculado'),
  ])
  for (const r of [refsR, linhasR, tipsR, clientesR, colunasR, orcR]) if (r.error) throw r.error

  const refs = new Map<string, RefTipologia>()
  for (const r of refsR.data || []) refs.set(`${norm(r.linha_raw)}|${norm(r.modelo_raw)}`, r as RefTipologia)
  const linhas = new Map<string, RefLinha>()
  for (const r of linhasR.data || []) linhas.set(norm(r.linha_raw), r as RefLinha)
  const tipologias = new Map<string, any>((tipsR.data || []).map((t: any) => [String(t.id), t]))

  const clientes = (clientesR.data || []) as any[]
  const porDoc = new Map<string, any[]>(), porFone = new Map<string, any[]>(), porNome = new Map<string, any[]>()
  for (const c of clientes) {
    const d = digitos(c.cpf_cnpj)
    if (d) porDoc.set(d, [...(porDoc.get(d) || []), c])
    for (const contato of [c.whatsapp, c.telefone]) {
      const f = digitos(contato).slice(-11)
      if (f) porFone.set(f, [...(porFone.get(f) || []), c])
    }
    const n = normalizarNomeClienteWVetro(c.nome)
    if (n) porNome.set(n, [...(porNome.get(n) || []), c])
  }
  const colunas = (colunasR.data || []) as any[]
  // Orçamento vindo do W.Vetro já está elaborado: entra diretamente em
  // "Orçamento feito" e aguarda somente a conferência/validação comercial.
  const coluna =
    colunas.find(c => norm(c.nome) === 'ORCAMENTO FEITO') ||
    colunas.find(c => norm(c.nome).includes('ORCAMENTO') && norm(c.nome).includes('FEITO')) ||
    colunas[0] ||
    null
  const colunaFazer = colunas.find(c => norm(c.nome) === 'FAZER ORCAMENTO') || null
  const existentes = new Map<string, any>()
  for (const o of orcR.data || []) {
    const fluxo = obj(o.wvetro_fluxo)
    const numero = txt(fluxo?.numero, fluxo?.numero_wvetro)
    if (numero) existentes.set(numero, o)
  }
  return { refs, linhas, tipologias, clientes, porDoc, porFone, porNome, coluna, colunaFazer, existentes }
}

function enderecoClienteWVetro(p: Record<string, any>) {
  const e = obj(p.Endereco) || obj(p.endereco) || {}
  const rua = txt(p.PessoaEndereco, p.ClienteEndereco, e.Rua, e.Logradouro)
  const numero = txt(p.PessoaNumero, p.ClienteNumero, e.Nro, e.Numero)
  const complemento = txt(p.PessoaComplemento, p.ClienteComplemento, e.Complemento)
  const endereco = [rua, rua && numero ? numero : '', complemento].filter(Boolean).join(', ')
  return {
    cidade: txt(p.PessoaCidade, p.ClienteCidade, p.Cidade, e.Cidade) || null,
    endereco: endereco || null,
    bairro: txt(p.PessoaBairro, p.ClienteBairro, p.Bairro, e.Bairro) || null,
    cep: txt(p.PessoaCEP, p.ClienteCEP, p.CEP, p.Cep, e.CEP, e.Cep) || null,
  }
}

function acharCliente(p: Record<string, any>, ctx: Awaited<ReturnType<typeof carregarContexto>>) {
  const nome = nomeCliente(p)
  const chaveNome = normalizarNomeClienteWVetro(nome)
  if (!chaveNome) return null

  // Regra principal: o nome do cliente vindo do W.Vetro precisa ser compatível.
  // CPF/CNPJ e telefone servem apenas para desempatar nomes compatíveis; nunca
  // podem vincular um orçamento a um nome diferente.
  const exatos = ctx.porNome.get(chaveNome) || []
  if (exatos.length === 1) return exatos[0]

  const compativeis = ctx.clientes.filter((c: any) => nomesClientesCompativeis(nome, c?.nome))

  const d = digitos(documentoCliente(p))
  if (d) {
    const porDocumento = (ctx.porDoc.get(d) || []).filter((c: any) => nomesClientesCompativeis(nome, c?.nome))
    if (porDocumento.length === 1) return porDocumento[0]
  }

  const f = digitos(telefoneCliente(p)).slice(-11)
  if (f) {
    const porTelefone = (ctx.porFone.get(f) || []).filter((c: any) => nomesClientesCompativeis(nome, c?.nome))
    if (porTelefone.length === 1) return porTelefone[0]
  }

  if (compativeis.length === 1) return compativeis[0]
  return null
}

async function hidratarClienteWVetro(cliente: any, p: Record<string, any>, empresaId: string) {
  if (!cliente?.id) return cliente
  const endereco = enderecoClienteWVetro(p)
  const telefone = telefoneCliente(p)
  const patch: Record<string, any> = {}
  if (!txt(cliente.whatsapp) && telefone) patch.whatsapp = telefone
  if (!txt(cliente.telefone) && txt(p.PessoaTelefone, p.ClienteTelefone, p.Telefone)) patch.telefone = txt(p.PessoaTelefone, p.ClienteTelefone, p.Telefone)
  if (!txt(cliente.email) && txt(p.PessoaEmail, p.ClienteEmail, p.Email)) patch.email = txt(p.PessoaEmail, p.ClienteEmail, p.Email).toLowerCase()
  if (!txt(cliente.cidade) && endereco.cidade) patch.cidade = endereco.cidade
  if ((!txt(cliente.endereco) || txt(cliente.endereco) === '[object Object]') && endereco.endereco) patch.endereco = endereco.endereco
  else if (txt(cliente.endereco) === '[object Object]' && !endereco.endereco) patch.endereco = null
  if (!txt(cliente.bairro) && endereco.bairro) patch.bairro = endereco.bairro
  if (!txt(cliente.cep) && endereco.cep) patch.cep = endereco.cep
  if (!Object.keys(patch).length) return cliente
  patch.updated_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('clientes').update(patch).eq('id', cliente.id).eq('empresa_id', empresaId).select('id,nome,cpf_cnpj,whatsapp,telefone,email,cidade,endereco,bairro,cep,origem').single()
  if (error) throw error
  return { ...cliente, ...data }
}

async function resolverPendenciaWVetroNome(empresaId: string, nome: string, clienteId: string) {
  await supabaseAdmin
    .from('cadastro_pendencias')
    .update({
      status: 'resolvida',
      cliente_id: clienteId,
      cliente_candidato_id: clienteId,
      resolvido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('empresa_id', empresaId)
    .eq('origem', 'wvetro')
    .eq('tipo', 'vinculo_wvetro')
    .eq('status', 'pendente')
    .contains('dados', { nome })
}

function adicionarClienteAoContexto(cliente: any, ctx: Awaited<ReturnType<typeof carregarContexto>>) {
  const d = digitos(cliente?.cpf_cnpj)
  if (d) ctx.porDoc.set(d, [...(ctx.porDoc.get(d) || []), cliente])
  const f = digitos(cliente?.whatsapp || cliente?.telefone).slice(-11)
  if (f) ctx.porFone.set(f, [...(ctx.porFone.get(f) || []), cliente])
  const n = normalizarNomeClienteWVetro(cliente?.nome)
  if (n) ctx.porNome.set(n, [...(ctx.porNome.get(n) || []), cliente])
  if (cliente?.id && !ctx.clientes.some((c: any) => c.id === cliente.id)) ctx.clientes.push(cliente)
}

async function garantirCliente(
  p: Record<string, any>,
  ctx: Awaited<ReturnType<typeof carregarContexto>>,
  empresaId: string,
  numeroWvetro: string,
) {
  const encontrado = acharCliente(p, ctx)
  if (encontrado) {
    const cliente = await hidratarClienteWVetro(encontrado, p, empresaId)
    await resolverPendenciaWVetroNome(empresaId, nomeCliente(p), cliente.id)
    const incompleto = nomeCadastroIncompleto(cliente.nome)
    if (incompleto) {
      await registrarPendenciaCadastro({
        empresaId,
        tipo: 'cadastro_incompleto',
        chaveUnica: `cliente:${cliente.id}:nome_incompleto`,
        titulo: `Completar cadastro de ${cliente.nome}`,
        descricao: 'O W.Vetro enviou apenas um nome. Complete nome e sobrenome ou valide se este cadastro deve ser vinculado a um cliente já existente.',
        origem: 'wvetro',
        clienteId: cliente.id,
        dados: { numero_wvetro: numeroWvetro, nome: cliente.nome },
      })
    }
    return { cliente, criado: false, pendencia: incompleto }
  }

  const nome = nomeCliente(p)
  if (!nome || norm(nome) === 'CLIENTE W.VETRO') return { cliente: null, criado: false, pendencia: false }

  const documento = documentoCliente(p)
  const telefone = telefoneCliente(p)
  const nomeNorm = normalizarNomeClienteWVetro(nome)
  const codigoWvetro = txt(p.ClienteCodigo, p.PessoaCodigo, p.PessoaId, p.ClienteId)
  const semIdentificadorForte = !digitos(documento) && !digitos(telefone)

  if (semIdentificadorForte) {
    const candidatos = ctx.clientes
      .filter((c: any) => nomesClientesCompativeis(nome, c?.nome))
      .slice(0, 20)

    if (candidatos.length > 0) {
      await registrarPendenciaCadastro({
        empresaId,
        tipo: 'vinculo_wvetro',
        chaveUnica: `wvetro:cliente:nome:${nomeNorm}`,
        titulo: `Vincular cliente W.Vetro: ${nome}`,
        descricao: 'O W.Vetro enviou o cliente sem CPF/CNPJ ou telefone confiável e há cadastro compatível no Atlas. Confirme o vínculo antes de unir os históricos.',
        origem: 'wvetro',
        dados: {
          numero_wvetro: numeroWvetro,
          cliente_codigo_wvetro: codigoWvetro || null,
          nome,
          documento: documento || null,
          telefone: telefone || null,
          candidatos: candidatos.map((c: any) => ({
            id: c.id,
            nome: c.nome,
            cpf_cnpj: c.cpf_cnpj || null,
            whatsapp: c.whatsapp || null,
            telefone: c.telefone || null,
            cidade: c.cidade || null,
          })),
        },
      })
      return { cliente: null, criado: false, pendencia: true }
    }
  }

  const endereco = enderecoClienteWVetro(p)
  const payload = {
    empresa_id: empresaId,
    nome,
    whatsapp: telefone || null,
    telefone: txt(p.PessoaTelefone, p.ClienteTelefone, p.Telefone) || null,
    cpf_cnpj: documento || null,
    cidade: endereco.cidade,
    endereco: endereco.endereco,
    bairro: endereco.bairro,
    cep: endereco.cep,
    email: txt(p.PessoaEmail, p.ClienteEmail, p.Email).toLowerCase() || null,
    origem: 'W.Vetro',
    observacoes: 'Cadastro criado automaticamente pela integração W.Vetro.',
  }

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .insert(payload)
    .select('id,nome,cpf_cnpj,whatsapp,telefone,email,cidade,endereco,bairro,cep,origem')
    .single()
  if (error) throw error

  const cliente = { ...payload, ...data }
  adicionarClienteAoContexto(cliente, ctx)

  const incompleto = nomeCadastroIncompleto(nome)
  if (incompleto) {
    await registrarPendenciaCadastro({
      empresaId,
      tipo: 'cadastro_incompleto',
      chaveUnica: `cliente:${data.id}:nome_incompleto`,
      titulo: `Completar cadastro de ${nome}`,
      descricao: 'O W.Vetro enviou apenas um nome. Complete nome e sobrenome ou valide se este cadastro deve ser vinculado a um cliente já existente.',
      origem: 'wvetro',
      clienteId: data.id,
      dados: {
        numero_wvetro: numeroWvetro,
        cliente_codigo_wvetro: codigoWvetro || null,
        nome,
        documento: documento || null,
        telefone: telefone || null,
      },
    })
  }

  return { cliente, criado: true, pendencia: incompleto }
}

export async function sincronizar(req: NextRequest, usuarioForcado?: UsuarioWVetro, diasPadrao = 7) {
  const usuario = usuarioForcado || await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, any>
  const forcar = body.forcar === true || String(body.modo || '').trim().toLowerCase() === 'corrigir_tudo'
  const fim = txt(body.fim) || new Date().toISOString().slice(0, 10)
  const inicio = txt(body.inicio) || new Date(Date.now() - (Math.max(1, diasPadrao) - 1) * 86400000).toISOString().slice(0, 10)
  const clienteAlvoId = txt(body.clienteAlvoId)
  const vinculoManualValidado = body.vinculoManualValidado === true

  try {
    const [payloadOrcamentos, payloadPedidos] = await Promise.all([
      consultarRecursoOperacionalWVetro('orcamentos', { inicio, fim }),
      consultarRecursoOperacionalWVetro('pedidos', { inicio, fim }),
    ])
    const stagingOrcamentos = transformarPayloadWVetroEmStaging('orcamentos', payloadOrcamentos)
    const stagingPedidos = transformarPayloadWVetroEmStaging('pedidos', payloadPedidos)

    // O mesmo número pode aparecer como orçamento e depois como pedido vendido.
    // Pedido tem precedência porque representa o estado comercial mais recente.
    const porNumero = new Map<string, { registro: any; fonteRegistro: 'orcamento' | 'pedido' }>()
    for (const registro of stagingOrcamentos.registros) {
      const numero = txt(registro.payload?.Nro, registro.payload?.OrcamentoId, registro.payload?.Orcamentoid)
      if (numero) porNumero.set(numero, { registro, fonteRegistro: 'orcamento' })
    }
    for (const registro of stagingPedidos.registros) {
      const numero = txt(registro.payload?.Nro, registro.payload?.OrcamentoId, registro.payload?.Orcamentoid)
      if (numero) porNumero.set(numero, { registro, fonteRegistro: 'pedido' })
    }

    const numerosSolicitados = new Set(
      (Array.isArray(body.numerosWvetro) ? body.numerosWvetro : [])
        .map((v: unknown) => String(v ?? '').trim())
        .filter(Boolean),
    )
    const registros = Array.from(porNumero.entries())
      .filter(([numero]) => numerosSolicitados.size === 0 || numerosSolicitados.has(numero))
      .map(([, valor]) => valor)

    const ctx = await carregarContexto(usuario.empresa_id)
    const clienteAlvo = clienteAlvoId ? ctx.clientes.find((c: any) => String(c.id) === clienteAlvoId) || null : null
    if (clienteAlvoId && !clienteAlvo) return NextResponse.json({ error: 'Cliente alvo não encontrado nesta empresa.' }, { status: 404 })
    const margensCidade = new Map<string, Awaited<ReturnType<typeof resolverMargemOrcamentoPorCidade>>>()
    let criados = 0, atualizados = 0, semAlteracao = 0, clientesVinculados = 0, clientesCriados = 0, itensMapeados = 0, itensPendentes = 0, pendenciasCadastro = 0, ignoradosClienteDivergente = 0
    const resultados: any[] = []

    for (const entrada of registros) {
      const registro = entrada.registro
      const fonteRegistro = entrada.fonteRegistro
      const p = registro.payload
      const numeroW = txt(p.Nro, p.OrcamentoId, p.Orcamentoid)
      if (!numeroW) continue
      const nome = nomeCliente(p)
      if (clienteAlvo && !nomesClientesCompativeis(nome, clienteAlvo.nome) && !vinculoManualValidado) {
        ignoradosClienteDivergente += 1
        resultados.push({
          numeroWvetro: numeroW,
          acao: 'ignorado_cliente_divergente',
          clienteWvetro: nome,
          clienteAlvo: clienteAlvo.nome,
        })
        continue
      }

      // Exceção controlada: um nome abreviado/homônimo só pode ultrapassar a trava
      // quando veio de uma validação humana e a chamada está limitada a números
      // W.Vetro explícitos. Nunca liberamos uma janela inteira por esse caminho.
      if (clienteAlvo && vinculoManualValidado && numerosSolicitados.size === 0) {
        return NextResponse.json({ error: 'Validação manual exige número W.Vetro explícito.' }, { status: 400 })
      }

      const rawItens = arr(p.Itens).length ? arr(p.Itens) : arr(p.itens)
      const itens = rawItens.map((x, i) => itemWVetro(obj(x) || {}, i, ctx.refs, ctx.linhas, ctx.tipologias))
      itensMapeados += itens.filter(i => i.tipologia_id).length
      itensPendentes += itens.filter(i => !i.tipologia_id).length
      const clienteResolvido = clienteAlvo
        ? { cliente: await hidratarClienteWVetro(clienteAlvo, p, usuario.empresa_id), criado: false, pendencia: false }
        : await garantirCliente(p, ctx, usuario.empresa_id, numeroW)
      const cliente = clienteResolvido.cliente
      if (cliente) clientesVinculados += 1
      if (clienteResolvido.criado) clientesCriados += 1
      if (clienteResolvido.pendencia) pendenciasCadastro += 1
      const cidadeOrcamento = txt(p.Cidade, p.PessoaCidade, p.ClienteCidade, obj(p.Endereco)?.Cidade, cliente?.cidade)
      const chaveCidade = normalizarCidadeMargem(cidadeOrcamento)
      let regraMargem = margensCidade.get(chaveCidade)
      if (!regraMargem) {
        regraMargem = await resolverMargemOrcamentoPorCidade(usuario.empresa_id, cidadeOrcamento)
        margensCidade.set(chaveCidade, regraMargem)
      }
      const valor = num(p.ValorTotal, p.Total, p.ValorBruto, p.Valor)
      const primeiro = itens[0] || {}
      const fluxo = {
        origem: 'wvetro_api',
        numero: numeroW,
        chave_externa: registro.chaveExterna,
        payload_hash: registro.payloadHash,
        data_referencia: registro.dataReferencia,
        sincronizado_em: new Date().toISOString(),
        situacao: txt(p.Situacao, p.Status) || null,
        vendedor: txt(p.VendedorNome, p.NomeVendedor) || null,
        fonte_registro: fonteRegistro,
        cliente_codigo_wvetro: txt(p.ClienteCodigo, p.PessoaCodigo) || null,
        cliente_nome_wvetro: nome || null,
        cliente_alvo_id: clienteAlvo?.id || null,
        validacao_manual_cliente: vinculoManualValidado || null,
        payload_bruto: p,
        mapeamento_versao: 3,
        validacao_status: 'aguardando',
        validado_em: null,
        validado_por_id: null,
        validado_por_nome: null,
      }
      const existente = ctx.existentes.get(numeroW)
      if (existente) {
        if (clienteAlvo?.id && existente.cliente_id && existente.cliente_id !== clienteAlvo.id) {
          resultados.push({
            id: existente.id,
            numeroWvetro: numeroW,
            acao: 'bloqueado_outro_cliente',
            clienteWvetro: nome,
            clienteAlvo: clienteAlvo.nome,
          })
          continue
        }
        const anterior = obj(existente.wvetro_fluxo)
        const mesmoPayload = txt(anterior?.payload_hash) === registro.payloadHash
        const manterValidacao =
          mesmoPayload &&
          txt(anterior?.validacao_status).toLowerCase() === 'validado'
        const fluxoAtualizado = manterValidacao
          ? {
              ...fluxo,
              validacao_status: 'validado',
              validado_em: anterior?.validado_em || null,
              validado_por_id: anterior?.validado_por_id || null,
              validado_por_nome: anterior?.validado_por_nome || null,
            }
          : fluxo
        const clienteJaVinculado = clienteResolvido.pendencia ? !existente.cliente_id : (!cliente?.id || existente.cliente_id === cliente.id)
        const valorAtual = num(existente.valor_estimado)
        const valorComEscalaIncorreta =
          valor > 0 &&
          valorAtual > 0 &&
          (
            Math.abs(valorAtual * 100 - valor) <= 0.01 ||
            Math.abs(valorAtual * 10 - valor) <= 0.01
          )
        const precisaReprocessarMapeamento =
          Number(anterior?.mapeamento_versao || 0) < 2 ||
          valorAtual <= 0 ||
          valorComEscalaIncorreta
        if (mesmoPayload && clienteJaVinculado && !precisaReprocessarMapeamento && !forcar) {
          semAlteracao += 1
          resultados.push({ id: existente.id, numeroWvetro: numeroW, acao: 'sem_alteracao', cliente: nome, itens: itens.length })
          continue
        }
        // REGRA DE PRESERVAÇÃO: a sincronização W.Vetro atualiza somente os campos
        // que pertencem ao orçamento técnico/comercial importado. Anexos, fotos,
        // observações, histórico e demais dados manuais do card NÃO entram neste patch.
        const patch: any = {
          cliente_nome: nome,
          cliente_whatsapp: telefoneCliente(p) || null,
          cliente_id: cliente?.id || (clienteResolvido.pendencia ? null : existente.cliente_id || null),
          itens,
          tipo_esquadria: primeiro.tipo_esquadria || 'outro',
          largura_mm: primeiro.largura_mm || null,
          altura_mm: primeiro.altura_mm || null,
          quantidade: primeiro.quantidade || 1,
          acabamento: txt(p.Cor, p.Acabamento) || null,
          cidade: cidadeOrcamento || existente.cidade || null,
          valor_estimado: valor > 0 ? valor : null,
          updated_at: new Date().toISOString(),
          wvetro_fluxo: fluxoAtualizado,
          ...(
            ctx.coluna?.id &&
            (!existente.coluna_id || (ctx.colunaFazer?.id && existente.coluna_id === ctx.colunaFazer.id))
              ? { coluna_id: ctx.coluna.id, coluna_atualizada_em: new Date().toISOString() }
              : {}
          ),
          ...(String(existente.margem_padrao_origem || 'sistema') !== 'manual' ? {
            margem_padrao_pct: regraMargem.margem,
            margem_padrao_origem: regraMargem.origem,
            margem_regra_cidade_id: regraMargem.regraId,
          } : {}),
        }
        const { error } = await supabaseAdmin.from('orcamentos').update(patch).eq('id', existente.id).eq('empresa_id', usuario.empresa_id)
        if (error) throw error
        atualizados += 1
        resultados.push({ id: existente.id, numeroWvetro: numeroW, acao: 'atualizado', cliente: nome, itens: itens.length })
      } else {
        const id = randomUUID()
        const { error } = await supabaseAdmin.from('orcamentos').insert({
          id,
          empresa_id: usuario.empresa_id,
          cliente_id: cliente?.id || null,
          cliente_nome: nome,
          cliente_whatsapp: telefoneCliente(p) || null,
          cidade: cidadeOrcamento || null,
          origem: 'W.Vetro',
          tipo_esquadria: primeiro.tipo_esquadria || 'outro',
          largura_mm: primeiro.largura_mm || null,
          altura_mm: primeiro.altura_mm || null,
          quantidade: primeiro.quantidade || 1,
          acabamento: txt(p.Cor, p.Acabamento) || null,
          modo_entrada: 'wvetro_api',
          descricao_livre: null,
          valor_estimado: valor > 0 ? valor : null,
          margem_padrao_pct: regraMargem.margem,
          margem_padrao_origem: regraMargem.origem,
          margem_regra_cidade_id: regraMargem.regraId,
          status: 'rascunho',
          contramarco: null,
          itens,
          fotos_urls: [],
          anexos: [],
          tipo_medida: 'comum',
          revisao_grupo_id: id,
          coluna_id: ctx.coluna?.id || null,
          coluna_atualizada_em: new Date().toISOString(),
          orcamento_iniciado_em: registro.dataReferencia ? `${registro.dataReferencia}T12:00:00Z` : null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          wvetro_fluxo: fluxo,
        })
        if (error) throw error
        ctx.existentes.set(numeroW, { id, cliente_id: cliente?.id || null, obra_id: null, wvetro_fluxo: fluxo })
        criados += 1
        resultados.push({ id, numeroWvetro: numeroW, acao: 'criado', cliente: nome, itens: itens.length })
      }
    }

    return NextResponse.json({
      ok: true, inicio, fim,
      lidos: registros.length,
      semChave: stagingOrcamentos.semChave.length + stagingPedidos.semChave.length,
      criados, atualizados, semAlteracao,
      clientesVinculados, clientesCriados, itensMapeados, itensPendentes, pendenciasCadastro,
      ignoradosClienteDivergente,
      clienteAlvoId: clienteAlvo?.id || null,
      forcar,
      resultados: resultados.slice(0, 200),
    })
  } catch (e) {
    console.error('Erro ao sincronizar orçamentos W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar orçamentos W.Vetro.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) { return sincronizar(req) }

export async function GET(req: NextRequest) {
  const usuarioCron = await autenticarSchedulerWVetro(req)
  if (usuarioCron) {
    const diasSolicitados = Number(req.nextUrl.searchParams.get('dias') || 2)
    const dias = Math.min(7, Math.max(1, Number.isFinite(diasSolicitados) ? Math.round(diasSolicitados) : 2))
    return sincronizar(req, usuarioCron, dias)
  }

  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  const clienteId = String(req.nextUrl.searchParams.get('clienteId') || '').trim()
  let query = supabaseAdmin
    .from('orcamentos')
    .select('id,numero,cliente_id,cliente_nome,valor_estimado,updated_at,wvetro_fluxo,itens')
    .eq('empresa_id', usuario.empresa_id)
    .contains('wvetro_fluxo', { origem: 'wvetro_api' })
    .neq('modo_entrada', 'wvetro_api_vinculado')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (clienteId) query = query.eq('cliente_id', clienteId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    orcamentos: (data || []).map((o: any) => ({
      id: o.id,
      numeroAtlas: o.numero,
      numeroWvetro: txt(o.wvetro_fluxo?.numero),
      cliente: o.cliente_nome,
      valor: o.valor_estimado,
      itens: Array.isArray(o.itens) ? o.itens.length : 0,
      atualizadoEm: o.updated_at,
      situacaoWvetro: txt(o.wvetro_fluxo?.situacao) || null,
    })),
  })
}