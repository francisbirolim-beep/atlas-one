import { NextRequest, NextResponse } from 'next/server'
import { lerXmlNFe } from '@/lib/nfeEntradaServer'
import { enriquecerVinculosTenant } from '@/lib/nfeEntradaTenantServer'
import { lerPdfDanfeV7 } from '@/lib/danfePdfParserV7'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const form = await req.formData()
    const arquivo = form.get('arquivo')
    const modo = String(form.get('modo') || '').toLowerCase()

    if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Selecione um arquivo XML ou PDF.' }, { status: 400 })
    if (arquivo.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'O arquivo excede o limite de 15 MB.' }, { status: 413 })

    const nome = arquivo.name.toLowerCase()
    const ehXml = modo === 'xml' || nome.endsWith('.xml') || /xml/i.test(arquivo.type)
    const ehPdf = modo === 'pdf' || nome.endsWith('.pdf') || arquivo.type === 'application/pdf'
    if (!ehXml && !ehPdf) return NextResponse.json({ error: 'Formato não suportado. Envie XML da NF-e ou PDF/DANFE.' }, { status: 400 })

    let nf
    if (ehXml) {
      const texto = Buffer.from(await arquivo.arrayBuffer()).toString('utf8')
      nf = lerXmlNFe(texto)
    } else {
      const buffer = Buffer.from(await arquivo.arrayBuffer())
      nf = await lerPdfDanfeV7(buffer)
      console.info('[Compras][DANFE][diagnostico]', nf.diagnostico || 'sem diagnostico')
    }

    nf = await enriquecerVinculosTenant(nf, usuario.empresa_id)
    return NextResponse.json({
      ok: true,
      arquivo: { nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type || (ehXml ? 'application/xml' : 'application/pdf') },
      nf,
      seguranca: {
        nenhumaGravacao: true,
        observacao: 'Prévia somente leitura. Fiscal, vínculo, financeiro, custo e estoque só são gravados após ações explícitas.',
      },
    })
  } catch (error) {
    console.error('Erro ao criar prévia da NF de entrada:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao ler a nota.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
