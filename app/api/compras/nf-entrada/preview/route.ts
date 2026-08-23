import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { enriquecerVinculos, lerXmlNFe } from '@/lib/nfeEntradaServer'
import { lerPdfDanfeV2 } from '@/lib/danfePdfParserV2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticar(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario || null
}

export async function POST(req: NextRequest) {
  const usuario = await autenticar(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const form = await req.formData()
    const arquivo = form.get('arquivo')
    const modo = String(form.get('modo') || '').toLowerCase()

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Selecione um arquivo XML ou PDF.' }, { status: 400 })
    }

    if (arquivo.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo excede o limite de 15 MB.' }, { status: 413 })
    }

    const nome = arquivo.name.toLowerCase()
    const ehXml = modo === 'xml' || nome.endsWith('.xml') || /xml/i.test(arquivo.type)
    const ehPdf = modo === 'pdf' || nome.endsWith('.pdf') || arquivo.type === 'application/pdf'

    if (!ehXml && !ehPdf) {
      return NextResponse.json({ error: 'Formato não suportado. Envie XML da NF-e ou PDF/DANFE.' }, { status: 400 })
    }

    let nf
    if (ehXml) {
      const texto = Buffer.from(await arquivo.arrayBuffer()).toString('utf8')
      nf = lerXmlNFe(texto)
    } else {
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      nf = await lerPdfDanfeV2(buffer)
      if (!nf.itens.length) {
        console.info('[Compras][DANFE][diagnostico]', nf.diagnostico || 'sem diagnostico')
      }
    }

    nf = await enriquecerVinculos(nf)

    return NextResponse.json({
      ok: true,
      arquivo: { nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type || (ehXml ? 'application/xml' : 'application/pdf') },
      nf,
      seguranca: {
        nenhumaGravacao: true,
        observacao: 'Prévia somente leitura. A NF, os itens e os custos só serão gravados após confirmação explícita.',
      },
    })
  } catch (error) {
    console.error('Erro ao criar prévia da NF de entrada:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao ler a nota.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
