import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemEntrada = {
  uid?: string
  tipologiaId?: string
  nome?: string
  categoria?: string
  linhaId?: string
  cor?: string
  contramarco?: 'sim' | 'nao'
  vidro?: string
  usaVidro?: boolean | null
  arremate?: 'sim' | 'nao'
  quantidade?: number
}

function texto(v: unknown, max = 300) {
  return String(v ?? '').trim().slice(0, max)
}

function qtd(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const clienteId = texto(body.clienteId, 80)
    const obraId = texto(body.obraId, 80) || null
    const cidade = texto(body.cidade, 120)
    const temperatura = texto(body.temperatura, 30)
    const itens = Array.isArray(body.itens) ? (body.itens as ItemEntrada[]) : []

    if (!clienteId) return NextResponse.json({ error: 'Selecione o cliente.' }, { status: 400 })
    if (!itens.length) return NextResponse.json({ error: 'Adicione ao menos uma tipologia.' }, { status: 400 })

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('id,nome,whatsapp,telefone,cidade')
      .eq('id', clienteId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (clienteError || !cliente) return NextResponse.json({ error: 'Cliente inválido para a empresa atual.' }, { status: 400 })

    if (obraId) {
      const { data: obra } = await supabaseAdmin
        .from('obras')
        .select('id,cliente_id')
        .eq('id', obraId)
        .eq('empresa_id', usuario.empresa_id)
        .maybeSingle()
      if (!obra || obra.cliente_id !== clienteId) return NextResponse.json({ error: 'Obra inválida para este cliente.' }, { status: 400 })
    }

    const tipologiaIds = Array.from(new Set(itens.map(i => texto(i.tipologiaId, 80)).filter(Boolean)))
    const linhaIds = Array.from(new Set(itens.map(i => texto(i.linhaId, 80)).filter(Boolean)))

    const [{ data: tipologias }, { data: linhas }] = await Promise.all([
      tipologiaIds.length
        ? supabaseAdmin.from('tipologias').select('id,label,categoria').in('id', tipologiaIds)
        : Promise.resolve({ data: [] as any[] }),
      linhaIds.length
        ? supabaseAdmin.from('linhas_tecnicas').select('id,nome').eq('empresa_id', usuario.empresa_id).in('id', linhaIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const tipologiaMap = new Map((tipologias || []).map(t => [String(t.id), t]))
    const linhaMap = new Map((linhas || []).map(l => [String(l.id), l]))

    for (const item of itens) {
      const tid = texto(item.tipologiaId, 80)
      const lid = texto(item.linhaId, 80)
      if (!tid || !tipologiaMap.has(tid)) return NextResponse.json({ error: 'Existe tipologia inválida na seleção.' }, { status: 400 })
      if (!lid || !linhaMap.has(lid)) return NextResponse.json({ error: 'Existe linha técnica inválida na seleção.' }, { status: 400 })
      if (item.usaVidro === true && !texto(item.vidro, 200)) return NextResponse.json({ error: `Informe o vidro da tipologia ${texto(item.nome, 160) || tid}.` }, { status: 400 })
    }

    const orcamentoId = randomUUID()
    const itensPersistidos = itens.map((item, index) => {
      const tid = texto(item.tipologiaId, 80)
      const lid = texto(item.linhaId, 80)
      const tipologia = tipologiaMap.get(tid)
      const linha = linhaMap.get(lid)
      const nome = texto(item.nome, 180) || texto(tipologia?.label, 180) || `Item ${index + 1}`
      const categoria = texto(item.categoria, 80) || texto(tipologia?.categoria, 80) || 'outro'
      return {
        id: texto(item.uid, 100) || randomUUID(),
        tipo_esquadria: categoria,
        tipo_outro_texto: nome,
        quantidade: qtd(item.quantidade),
        cor: texto(item.cor, 80) || null,
        linha_id: lid,
        linha_nome: texto(linha?.nome, 180) || null,
        tipologia_id: tid,
        configuracao_nome: nome,
        configuracao_validada: false,
        configuracao_status: 'pendente',
        modo_configuracao: 'assistido',
        variaveis: {
          contramarco: item.contramarco === 'sim' ? 'sim' : 'nao',
          arremate: item.arremate === 'sim' ? 'sim' : 'nao',
          vidro: texto(item.vidro, 200) || null,
        },
      }
    })

    const primeiro = itensPersistidos[0]
    const { error } = await supabaseAdmin.from('orcamentos').insert({
      id: orcamentoId,
      empresa_id: usuario.empresa_id,
      cliente_id: cliente.id,
      obra_id: obraId,
      cliente_nome: cliente.nome,
      cliente_whatsapp: cliente.whatsapp || cliente.telefone || null,
      cidade: cidade || cliente.cidade || null,
      temperatura: temperatura || null,
      tipo_esquadria: primeiro.tipo_esquadria,
      quantidade: primeiro.quantidade,
      acabamento: primeiro.cor,
      contramarco: primeiro.variaveis.contramarco,
      itens: itensPersistidos,
      status: 'rascunho',
      modo_entrada: 'sob_medida_direto',
      coluna_id: null,
      revisao_grupo_id: orcamentoId,
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
      descricao_livre: 'Orçamento sob medida em composição e conferência de custos.',
    })

    if (error) {
      console.error('Erro ao criar rascunho sob medida:', error)
      return NextResponse.json({ error: 'Não foi possível criar o rascunho do orçamento.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, orcamentoId })
  } catch (error) {
    console.error('Erro no orçamento sob medida:', error)
    return NextResponse.json({ error: 'Falha ao iniciar o orçamento sob medida.' }, { status: 500 })
  }
}
