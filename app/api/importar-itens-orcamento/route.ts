import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { parseItensDoTextoPdf } from '@/lib/pdfOrcamentoImport'
import { Anexo, ItemEsquadria } from '@/lib/tipos'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
    }

    const body = await req.json()
    const orcamentoId = body?.orcamentoId
    if (!orcamentoId) {
      return NextResponse.json({ error: 'orcamentoId e obrigatorio' }, { status: 400 })
    }

    const { data: orcamento, error: erroOrcamento } = await supabaseAdmin
      .from('orcamentos')
      .select('id, itens, anexos')
      .eq('id', orcamentoId)
      .maybeSingle()

    if (erroOrcamento || !orcamento) {
      return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })
    }

    const anexos: Anexo[] = orcamento.anexos || []
    const anexoPdf = anexos.find(
      (a) => (a.nome || '').toLowerCase().endsWith('.pdf') || (a.url || '').toLowerCase().endsWith('.pdf')
    )
    if (!anexoPdf) {
      return NextResponse.json({ error: 'Nenhum PDF encontrado nos anexos deste orcamento.' }, { status: 400 })
    }

    const resposta = await fetch(anexoPdf.url)
    if (!resposta.ok) {
      return NextResponse.json({ error: 'Nao foi possivel baixar o PDF anexado.' }, { status: 502 })
    }
    const arrayBuffer = await resposta.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const pdfParse = (await import('pdf-parse')).default
    const dadosPdf = await pdfParse(buffer)
    const texto = dadosPdf.text || ''

    const itensParciais = parseItensDoTextoPdf(texto)
    if (itensParciais.length === 0) {
      return NextResponse.json(
        { error: 'Nao foi possivel identificar itens no PDF. Verifique o layout do anexo.' },
        { status: 422 }
      )
    }

    const itensCompletos: ItemEsquadria[] = itensParciais.map((it) => ({
      id: uuidv4(),
      ambiente: it.ambiente,
      tipo_esquadria: it.tipo_esquadria || 'outro',
      tipo_outro_texto: it.tipo_outro_texto,
      largura_mm: it.largura_mm || 0,
      altura_mm: it.altura_mm || 0,
      quantidade: it.quantidade || 1,
      descricao: it.descricao,
    }))

    const { error: erroUpdate } = await supabaseAdmin
      .from('orcamentos')
      .update({ itens: itensCompletos })
      .eq('id', orcamentoId)

    if (erroUpdate) {
      return NextResponse.json({ error: 'Erro ao salvar itens no orcamento.' }, { status: 500 })
    }

    const { data: medicao } = await supabaseAdmin
      .from('medicoes_finais')
      .select('id')
      .eq('orcamento_id', orcamentoId)
      .maybeSingle()

    if (medicao) {
      const { count } = await supabaseAdmin
        .from('medicao_itens')
        .select('id', { count: 'exact', head: true })
        .eq('medicao_id', medicao.id)

      if (!count) {
        const linhas = itensCompletos.map((it, idx) => ({
          medicao_id: medicao.id,
          tipo_esquadria: it.tipo_esquadria,
          tipo_outro_texto: it.tipo_outro_texto || null,
          descricao: it.descricao || "Item " + (idx + 1),
          quantidade: it.quantidade || 1,
          ordem: idx,
        }))
        await supabaseAdmin.from('medicao_itens').insert(linhas)
      }
    }

    return NextResponse.json({ itens: itensCompletos })
  } catch (e: any) {
    console.error('Erro ao importar itens do PDF:', e)
    return NextResponse.json({ error: 'Erro interno ao processar o PDF.' }, { status: 500 })
  }
}
