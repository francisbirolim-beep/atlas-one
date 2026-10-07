import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { neonStaging } from '@/lib/neonStaging'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { materializarPacoteTecnicoWVetro, temComposicaoWVetro } from '@/lib/wvetroPacoteTecnicoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function txt(...valores: unknown[]) {
  for (const valor of valores) {
    const s = String(valor ?? '').trim()
    if (s) return s
  }
  return ''
}

function n(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  let s = String(valor).trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const numero = Number(s)
  return Number.isFinite(numero) ? numero : 0
}

function obj(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, any>
    : {}
}

function arr(valor: unknown): any[] {
  return Array.isArray(valor) ? valor : []
}

function norm(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function mm(valor: unknown) {
  const numero = n(valor)
  if (numero <= 0) return 0
  return numero < 20 ? Math.round(numero * 1000) : Math.round(numero)
}

function dimensaoCompativel(a: number, b: number) {
  if (!a || !b) return false
  if (Math.abs(a - b) <= 15) return true
  const maior = Math.max(a, b)
  const menor = Math.min(a, b)
  return menor > 0 && Math.abs(maior / menor - 10) <= 0.02
}

function itemHistoricoDimensoes(item: any) {
  return {
    largura: mm(item?.largura ?? item?.Largura ?? item?.largura_mm),
    altura: mm(item?.altura ?? item?.Altura ?? item?.altura_mm),
    modelo: norm(item?.modelo ?? item?.Modelo ?? item?.nome ?? item?.Nome),
  }
}

function scoreCandidato(historico: any, itensAtlas: any[], valorVenda: number) {
  const itensHist = arr(historico.itens)
  if (!itensAtlas.length || itensHist.length !== itensAtlas.length) return -1

  let score = 50
  for (let i = 0; i < itensAtlas.length; i += 1) {
    const atlas = itensAtlas[i] || {}
    const hist = itemHistoricoDimensoes(itensHist[i] || {})
    const larguraAtlas = mm(atlas.largura_mm)
    const alturaAtlas = mm(atlas.altura_mm)
    if (dimensaoCompativel(larguraAtlas, hist.largura)) score += 8
    if (dimensaoCompativel(alturaAtlas, hist.altura)) score += 8

    const descricaoAtlas = norm(atlas.tipo_outro_texto || atlas.configuracao_nome || atlas.tipo_esquadria)
    if (descricaoAtlas && hist.modelo) {
      const palavras = hist.modelo.split(' ').filter((p: string) => p.length >= 4)
      if (palavras.some((p: string) => descricaoAtlas.includes(p))) score += 2
    }
  }

  const valorW = n(historico.valor_total)
  if (valorVenda > 0 && valorW > 0) {
    const diferencaPct = Math.abs(valorVenda - valorW) / Math.max(valorVenda, valorW)
    if (diferencaPct <= 0.02) score += 12
    else if (diferencaPct <= 0.08) score += 8
    else if (diferencaPct <= 0.15) score += 4
  }
  if (historico.data_venda) score += 3
  return score
}

async function payloadNeon(numero: string) {
  try {
    const sql = neonStaging()
    const orcamento = `orcamento:${numero}`
    const pedido = `pedido:${numero}`
    const rows = await sql`
      select recurso, chave_externa, payload, payload_hash, data_referencia
      from wvetro_migracao.raw
      where (recurso = 'orcamentos' and chave_externa = ${orcamento})
         or (recurso = 'pedidos' and chave_externa = ${pedido})
      order by case when recurso = 'pedidos' then 0 else 1 end, versao desc
      limit 1
    `
    const row = rows[0] as any
    if (!row?.payload) return null
    return {
      payload: obj(row.payload),
      hash: txt(row.payload_hash),
      fonte: txt(row.recurso) || 'neon',
      dataReferencia: txt(row.data_referencia) || null,
    }
  } catch (error) {
    console.warn('Snapshot Neon indisponível para materialização W.Vetro:', error)
    return null
  }
}

async function payloadWVetroAoVivo(numero: string, inicio?: string | null, fim?: string | null) {
  if (!inicio && !fim) return null
  const de = inicio || fim || undefined
  const ate = fim || inicio || undefined
  try {
    const [orcamentos, pedidos] = await Promise.all([
      consultarRecursoOperacionalWVetro('orcamentos', { inicio: de, fim: ate }),
      consultarRecursoOperacionalWVetro('pedidos', { inicio: de, fim: ate }),
    ])
    const todos = [
      ...transformarPayloadWVetroEmStaging('pedidos', pedidos).registros.map(registro => ({ ...registro, fonte: 'pedidos' })),
      ...transformarPayloadWVetroEmStaging('orcamentos', orcamentos).registros.map(registro => ({ ...registro, fonte: 'orcamentos' })),
    ]
    const encontrado = todos.find(registro => {
      const p = obj(registro.payload)
      return txt(p.Nro, p.OrcamentoId, p.Orcamentoid) === numero
    })
    if (!encontrado) return null
    return {
      payload: obj(encontrado.payload),
      hash: txt(encontrado.payloadHash),
      fonte: encontrado.fonte,
      dataReferencia: encontrado.dataReferencia || null,
    }
  } catch (error) {
    console.warn('Consulta ao vivo W.Vetro indisponível na materialização:', error)
    return null
  }
}

function rawTemComposicao(payload: Record<string, any>) {
  const itens = arr(payload.Itens).length ? arr(payload.Itens) : arr(payload.itens)
  return itens.some((item: any) =>
    arr(item?.Perfil).length > 0 ||
    arr(item?.Perfis).length > 0 ||
    arr(item?.Acessorios).length > 0 ||
    arr(item?.Acessórios).length > 0 ||
    arr(item?.Vidros).length > 0
  )
}

async function enriquecerItensAtlas(itensAtlas: any[], payload: Record<string, any>) {
  const rawItens = arr(payload.Itens).length ? arr(payload.Itens) : arr(payload.itens)
  const [{ data: refs }, { data: linhas }, { data: tipologias }] = await Promise.all([
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url'),
    supabaseAdmin.from('wvetro_referencias_linhas').select('linha_raw,linha_tecnica_id'),
    supabaseAdmin.from('tipologias').select('id,chave,label'),
  ])
  const refMapa = new Map<string, any>()
  for (const ref of refs || []) refMapa.set(`${norm(ref.linha_raw)}|${norm(ref.modelo_raw)}`, ref)
  const linhaMapa = new Map<string, any>()
  for (const linha of linhas || []) linhaMapa.set(norm(linha.linha_raw), linha)
  const tipMapa = new Map<string, any>((tipologias || []).map((t: any) => [String(t.id), t]))

  return rawItens.map((raw: any, indice: number) => {
    const atual = itensAtlas[indice] || {}
    const linhaRaw = txt(raw.Linha, raw.LinhaNome, raw.LinhaDescricao)
    const modeloRaw = txt(raw.Modelo, raw.Nome, raw.Descricao, raw.Codigo)
    const ref = refMapa.get(`${norm(linhaRaw)}|${norm(modeloRaw)}`) || null
    const tipologia = ref?.tipologia_atlas_id ? tipMapa.get(String(ref.tipologia_atlas_id)) : null
    const linha = linhaMapa.get(norm(linhaRaw)) || null
    const larguraW = mm(raw.Largura ?? raw.LarguraMM ?? raw.LarguraMm)
    const alturaW = mm(raw.Altura ?? raw.AlturaMM ?? raw.AlturaMm)
    const larguraAtual = mm(atual.largura_mm)
    const alturaAtual = mm(atual.altura_mm)

    const corrigirLargura = !larguraAtual || (
      larguraW > 0 && dimensaoCompativel(larguraAtual, larguraW) && Math.abs(larguraAtual - larguraW) > 15
    )
    const corrigirAltura = !alturaAtual || (
      alturaW > 0 && dimensaoCompativel(alturaAtual, alturaW) && Math.abs(alturaAtual - alturaW) > 15
    )

    return {
      ...atual,
      id: atual.id || crypto.randomUUID(),
      ambiente: txt(atual.ambiente, raw.Ambiente) || null,
      largura_mm: corrigirLargura ? larguraW : (larguraAtual || larguraW || null),
      altura_mm: corrigirAltura ? alturaW : (alturaAtual || alturaW || null),
      quantidade: Math.max(1, Math.round(n(raw.Qtde ?? raw.Quantidade) || n(atual.quantidade) || 1)),
      linha_id: linha?.linha_tecnica_id || atual.linha_id || null,
      linha_nome: linhaRaw || atual.linha_nome || null,
      tipologia_id: ref?.tipologia_atlas_id || atual.tipologia_id || null,
      tipo_esquadria: tipologia?.chave || atual.tipo_esquadria || 'outro',
      tipo_outro_texto: tipologia ? (atual.tipo_outro_texto || null) : (atual.tipo_outro_texto || modeloRaw || null),
      configuracao_nome: tipologia?.label || atual.configuracao_nome || modeloRaw || null,
      wvetro_item: raw,
      wvetro_composicao: {
        perfis: arr(raw.Perfil).length ? arr(raw.Perfil) : arr(raw.Perfis),
        acessorios: arr(raw.Acessorios).length ? arr(raw.Acessorios) : arr(raw.Acessórios),
        vidros: arr(raw.Vidros),
      },
      referencia_wvetro: ref ? {
        referencia_id: ref.id,
        tipologia_id: ref.tipologia_atlas_id,
        linha: linhaRaw,
        modelo: modeloRaw,
        imagem_url: ref.imagem_url || null,
        utilizada_como_base: true,
        origem: 'venda_materializada',
      } : atual.referencia_wvetro || null,
    }
  })
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, any>
  const vendaId = txt(body.vendaId)
  const numeroSolicitado = txt(body.numeroWvetro)
  if (!vendaId) return NextResponse.json({ error: 'Venda não informada.' }, { status: 400 })

  try {
    const { data: venda, error: erroVenda } = await supabaseAdmin
      .from('vendas_obras')
      .select('id,orcamento_id,cliente_id,obra_id,valor_venda,status')
      .eq('id', vendaId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (erroVenda) throw erroVenda
    if (!venda) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })

    const { data: orcamento, error: erroOrcamento } = await supabaseAdmin
      .from('orcamentos')
      .select('id,cliente_id,cliente_nome,itens,wvetro_fluxo,valor_estimado,custo_estimado')
      .eq('id', venda.orcamento_id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (erroOrcamento) throw erroOrcamento
    if (!orcamento) return NextResponse.json({ error: 'Orçamento da venda não encontrado.' }, { status: 404 })

    if (temComposicaoWVetro(orcamento.itens)) {
      const pacote = await materializarPacoteTecnicoWVetro(orcamento.id, usuario)
      return NextResponse.json({
        ok: pacote.ok,
        fonte: 'orcamento_atlas',
        numeroWvetro: txt(obj(orcamento.wvetro_fluxo).numero),
        pacote,
      }, { status: pacote.ok ? 200 : 422 })
    }

    const { data: historicos, error: erroHistorico } = await supabaseAdmin
      .from('wvetro_historico_comercial')
      .select('id,numero_wvetro,cliente_nome_origem,data_emissao,data_venda,valor_total,status_vinculo,itens')
      .eq('empresa_id', usuario.empresa_id)
      .eq('cliente_id', venda.cliente_id)
      .eq('status_vinculo', 'seguro')
      .not('numero_wvetro', 'is', null)
      .order('data_venda', { ascending: false, nullsFirst: false })
      .order('data_emissao', { ascending: false, nullsFirst: false })
      .limit(100)
    if (erroHistorico) throw erroHistorico

    const itensAtlas = arr(orcamento.itens)
    const candidatos = (historicos || [])
      .filter((h: any) => !numeroSolicitado || txt(h.numero_wvetro) === numeroSolicitado)
      .map((h: any) => ({ ...h, score: scoreCandidato(h, itensAtlas, n(venda.valor_venda)) }))
      .filter((h: any) => h.score >= 65)
      .sort((a: any, b: any) => b.score - a.score)

    if (!candidatos.length) {
      return NextResponse.json({
        error: numeroSolicitado
          ? `O W.Vetro #${numeroSolicitado} não foi confirmado como vínculo seguro desta venda.`
          : 'Nenhum orçamento W.Vetro seguro com as mesmas peças desta venda foi encontrado.',
      }, { status: 409 })
    }

    const melhor = candidatos[0]
    const segundo = candidatos[1]
    if (!numeroSolicitado && segundo && segundo.score >= melhor.score - 5) {
      return NextResponse.json({
        error: 'Há mais de um orçamento W.Vetro possível. Escolha o número antes de materializar os materiais.',
        candidatos: candidatos.slice(0, 10).map((c: any) => ({
          numeroWvetro: c.numero_wvetro,
          cliente: c.cliente_nome_origem,
          valor: c.valor_total,
          data: c.data_venda || c.data_emissao,
          score: c.score,
        })),
      }, { status: 409 })
    }

    const numeroWvetro = txt(melhor.numero_wvetro)
    let snapshot = await payloadNeon(numeroWvetro)
    if (!snapshot?.payload || !rawTemComposicao(snapshot.payload)) {
      snapshot = await payloadWVetroAoVivo(
        numeroWvetro,
        txt(melhor.data_emissao) || null,
        txt(melhor.data_venda, melhor.data_emissao) || null,
      )
    }

    if (!snapshot?.payload || !rawTemComposicao(snapshot.payload)) {
      return NextResponse.json({
        error: `O W.Vetro #${numeroWvetro} foi identificado, mas o snapshot completo de perfis/acessórios/vidros não está disponível.`,
        numeroWvetro,
      }, { status: 422 })
    }

    const itensEnriquecidos = await enriquecerItensAtlas(itensAtlas, snapshot.payload)
    const { data: resumoWVetro } = await supabaseAdmin
      .from('wvetro_orcamentos_historico')
      .select('custo_com_sobra,custo_sem_sobra,total_m2,valor_total,valor_bruto')
      .eq('empresa_id', usuario.empresa_id)
      .eq('wvetro_numero', numeroWvetro)
      .maybeSingle()

    const fluxoAtual = obj(orcamento.wvetro_fluxo)
    const fluxo = {
      ...fluxoAtual,
      origem: 'wvetro_venda_materializada',
      numero: numeroWvetro,
      cliente_nome_wvetro: txt(snapshot.payload.PessoaNome, snapshot.payload.ClienteNome, melhor.cliente_nome_origem) || null,
      payload_hash: snapshot.hash || null,
      payload_bruto: snapshot.payload,
      fonte_registro: snapshot.fonte,
      data_referencia: snapshot.dataReferencia || melhor.data_emissao || null,
      materializado_em: new Date().toISOString(),
      materializado_por_id: usuario.id,
      materializado_por_nome: usuario.nome,
      valor_total_wvetro: resumoWVetro?.valor_total ?? melhor.valor_total ?? null,
      valor_bruto_wvetro: resumoWVetro?.valor_bruto ?? null,
      custo_com_sobra: resumoWVetro?.custo_com_sobra ?? null,
      custo_sem_sobra: resumoWVetro?.custo_sem_sobra ?? null,
      total_m2_wvetro: resumoWVetro?.total_m2 ?? null,
      financeiro_atlas_preservado: true,
    }

    const { error: erroUpdate } = await supabaseAdmin
      .from('orcamentos')
      .update({
        itens: itensEnriquecidos,
        wvetro_fluxo: fluxo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orcamento.id)
      .eq('empresa_id', usuario.empresa_id)
    if (erroUpdate) throw erroUpdate

    const pacote = await materializarPacoteTecnicoWVetro(orcamento.id, usuario)
    if (!pacote.ok) {
      return NextResponse.json({ error: pacote.error, numeroWvetro }, { status: 422 })
    }

    return NextResponse.json({
      ok: true,
      numeroWvetro,
      clienteWvetro: melhor.cliente_nome_origem,
      score: melhor.score,
      fonteSnapshot: snapshot.fonte,
      pacote,
      financeiroPreservado: true,
      mensagem: `Materiais do W.Vetro #${numeroWvetro} carregados nesta venda sem alterar o valor financeiro já fechado no Atlas.`,
    })
  } catch (error) {
    console.error('Erro ao materializar materiais W.Vetro da venda:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Falha ao materializar os materiais do W.Vetro.',
    }, { status: 500 })
  }
}
