import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type DadosValidados = {
  tipologiaId: string
  produtoId: string | null
  nome: string
  evidencia: string
  imagemUrl?: string | null
  valoresNormalizados: Record<string, string>
  camposCorte: Record<string, string>
}

function normalizarCamposCorte(input: unknown): Record<string, string> {
  const resultado: Record<string, string> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return resultado
  const entradas = Object.entries(input as Record<string, unknown>).slice(0, 60)
  for (const [chaveRaw, valorRaw] of entradas) {
    const chave = String(chaveRaw).trim().slice(0, 40)
    const valor = typeof valorRaw === 'string' ? valorRaw.trim().slice(0, 500) : ''
    if (!chave || !valor) continue
    resultado[chave] = valor
  }
  return resultado
}

async function exigirMaster(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return { erro: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { erro: NextResponse.json({ error: 'Sessao invalida' }, { status: 401 }) }
  }

  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, role, empresa_id')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!perfil || perfil.role !== 'master' || !perfil.empresa_id) {
    return { erro: NextResponse.json({ error: 'Somente o Master pode publicar configuracoes validadas.' }, { status: 403 }) }
  }

  return { perfil }
}

async function validarDadosConfiguracao(
  body: any,
  empresaId: string,
  excluirId?: string,
): Promise<{ dados?: DadosValidados; erro?: NextResponse }> {
  const tipologiaId = typeof body.tipologiaId === 'string' ? body.tipologiaId.trim() : ''
  const produtoId = typeof body.produtoId === 'string' && body.produtoId.trim() ? body.produtoId.trim() : null
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const evidencia = typeof body.evidencia === 'string' ? body.evidencia.trim() : ''
  const valores = body.valores && typeof body.valores === 'object' && !Array.isArray(body.valores)
    ? body.valores as Record<string, unknown>
    : {}
  const camposCorte = normalizarCamposCorte(body.camposCorte)

  let imagemUrl: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'imagemUrl')) {
    if (body.imagemUrl == null || body.imagemUrl === '') {
      imagemUrl = null
    } else if (typeof body.imagemUrl === 'string') {
      imagemUrl = body.imagemUrl.trim()
    } else {
      return { erro: NextResponse.json({ error: 'URL da imagem da configuracao invalida.' }, { status: 400 }) }
    }
  }

  if (!tipologiaId) return { erro: NextResponse.json({ error: 'Selecione a tipologia.' }, { status: 400 }) }
  if (nome.length < 3 || nome.length > 120) return { erro: NextResponse.json({ error: 'Nome da configuracao deve ter entre 3 e 120 caracteres.' }, { status: 400 }) }
  if (evidencia.length < 5 || evidencia.length > 1000) return { erro: NextResponse.json({ error: 'Registre uma evidencia tecnica objetiva para a validacao.' }, { status: 400 }) }
  if (imagemUrl && !/^https?:\/\//i.test(imagemUrl)) return { erro: NextResponse.json({ error: 'URL da imagem da configuracao invalida.' }, { status: 400 }) }

  const { data: tipologia } = await supabaseAdmin
    .from('tipologias')
    .select('id, label')
    .eq('id', tipologiaId)
    .maybeSingle()
  if (!tipologia) return { erro: NextResponse.json({ error: 'Tipologia nao encontrada.' }, { status: 400 }) }

  if (produtoId) {
    const { data: produto } = await supabaseAdmin
      .from('produtos')
      .select('id, ativo')
      .eq('id', produtoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!produto || !produto.ativo) return { erro: NextResponse.json({ error: 'Produto base nao encontrado ou inativo.' }, { status: 400 }) }
  }

  const { data: vinculos, error: erroVinculos } = await supabaseAdmin
    .from('engenharia_tipologia_variaveis')
    .select('variavel_id, obrigatorio, variavel:engenharia_variaveis(chave, label)')
    .eq('tipologia_id', tipologiaId)
    .order('ordem')
  if (erroVinculos) return { erro: NextResponse.json({ error: 'Nao foi possivel ler as variaveis da tipologia.' }, { status: 400 }) }

  const ids = (vinculos || []).map((v: any) => v.variavel_id)
  let opcoes: any[] = []
  if (ids.length) {
    const { data, error } = await supabaseAdmin
      .from('engenharia_variavel_opcoes')
      .select('variavel_id, chave, label')
      .in('variavel_id', ids)
    if (error) return { erro: NextResponse.json({ error: 'Nao foi possivel ler as opcoes das variaveis.' }, { status: 400 }) }
    opcoes = data || []
  }

  const permitidoPorChave = new Map<string, Set<string>>()
  const obrigatorias: string[] = []
  for (const vinculo of (vinculos || []) as any[]) {
    const chave = vinculo.variavel?.chave as string | undefined
    if (!chave) continue
    const permitidas = new Set(opcoes.filter(o => o.variavel_id === vinculo.variavel_id).map(o => String(o.chave)))
    permitidoPorChave.set(chave, permitidas)
    if (vinculo.obrigatorio) obrigatorias.push(chave)
  }

  const valoresNormalizados: Record<string, string> = {}
  for (const [chave, valorRaw] of Object.entries(valores)) {
    if (!permitidoPorChave.has(chave)) {
      return { erro: NextResponse.json({ error: `Variavel "${chave}" nao pertence a esta tipologia.` }, { status: 400 }) }
    }
    const valor = typeof valorRaw === 'string' ? valorRaw.trim() : ''
    if (!valor) continue
    const permitidas = permitidoPorChave.get(chave)!
    if (!permitidas.has(valor)) {
      return { erro: NextResponse.json({ error: `Opcao "${valor}" nao e valida para a variavel "${chave}".` }, { status: 400 }) }
    }
    valoresNormalizados[chave] = valor
  }

  for (const chave of obrigatorias) {
    if (!valoresNormalizados[chave]) {
      return { erro: NextResponse.json({ error: `Preencha a variavel obrigatoria "${chave}" antes de validar.` }, { status: 400 }) }
    }
  }

  let duplicadaQuery = supabaseAdmin
    .from('engenharia_variaveis_preset')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('tipologia_id', tipologiaId)
    .eq('usar_no_orcamento', true)
    .eq('ativo', true)
    .ilike('nome', nome)
    .limit(1)
  duplicadaQuery = produtoId ? duplicadaQuery.eq('produto_id', produtoId) : duplicadaQuery.is('produto_id', null)
  if (excluirId) duplicadaQuery = duplicadaQuery.neq('id', excluirId)
  const { data: duplicada } = await duplicadaQuery.maybeSingle()
  if (duplicada) return { erro: NextResponse.json({ error: 'Ja existe uma configuracao ativa com esse nome para esta tipologia/produto.' }, { status: 409 }) }

  return {
    dados: {
      tipologiaId,
      produtoId,
      nome,
      evidencia,
      ...(Object.prototype.hasOwnProperty.call(body, 'imagemUrl') ? { imagemUrl } : {}),
      valoresNormalizados,
      camposCorte,
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await exigirMaster(req)
    if ('erro' in auth) return auth.erro
    const perfil = auth.perfil!

    const body = await req.json()
    const validacao = await validarDadosConfiguracao(body, perfil.empresa_id)
    if (validacao.erro) return validacao.erro
    const dados = validacao.dados!
    const agora = new Date().toISOString()

    const { data: configuracao, error } = await supabaseAdmin
      .from('engenharia_variaveis_preset')
      .insert({
        empresa_id: perfil.empresa_id,
        tipologia_id: dados.tipologiaId,
        produto_id: dados.produtoId,
        nome: dados.nome,
        valores: dados.valoresNormalizados,
        campos_corte: dados.camposCorte,
        ...(dados.imagemUrl !== undefined ? { imagem_url: dados.imagemUrl } : {}),
        padrao: false,
        usar_no_orcamento: true,
        validado: true,
        validado_em: agora,
        validado_por_id: perfil.id,
        validado_por_nome: perfil.nome,
        evidencia_validacao: dados.evidencia,
        ativo: true,
        criado_por_id: perfil.id,
        criado_por_nome: perfil.nome,
        updated_at: agora,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, configuracao })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await exigirMaster(req)
    if ('erro' in auth) return auth.erro
    const perfil = auth.perfil!

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Configuracao invalida.' }, { status: 400 })

    const { data: existente } = await supabaseAdmin
      .from('engenharia_variaveis_preset')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
      .eq('usar_no_orcamento', true)
      .maybeSingle()
    if (!existente) return NextResponse.json({ error: 'Configuracao nao encontrada.' }, { status: 404 })

    const validacao = await validarDadosConfiguracao(body, perfil.empresa_id, id)
    if (validacao.erro) return validacao.erro
    const dados = validacao.dados!
    const agora = new Date().toISOString()

    const { data: configuracao, error } = await supabaseAdmin
      .from('engenharia_variaveis_preset')
      .update({
        tipologia_id: dados.tipologiaId,
        produto_id: dados.produtoId,
        nome: dados.nome,
        valores: dados.valoresNormalizados,
        campos_corte: dados.camposCorte,
        ...(dados.imagemUrl !== undefined ? { imagem_url: dados.imagemUrl } : {}),
        validado: true,
        validado_em: agora,
        validado_por_id: perfil.id,
        validado_por_nome: perfil.nome,
        evidencia_validacao: dados.evidencia,
        updated_at: agora,
      })
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
      .eq('usar_no_orcamento', true)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, configuracao })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await exigirMaster(req)
    if ('erro' in auth) return auth.erro
    const perfil = auth.perfil!

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const ativo = body.ativo === true
    if (!id) return NextResponse.json({ error: 'Configuracao invalida.' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('engenharia_variaveis_preset')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
      .eq('usar_no_orcamento', true)
      .select('id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Configuracao nao encontrada.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
