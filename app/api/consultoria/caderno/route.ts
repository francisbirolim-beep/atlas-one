import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'atlas-consultoria-privado'
const EMPRESA_ESQUADRIFACIO = '87897d68-1334-491c-b29b-4065cd83760c'
const COMPETENCIA = '2026-08'
const HASH_PREVIA_VALIDADA = '2f95a90678fa0e0f306a0cca4777983f795536df141518ad269d6cd465cf02fd'
const HASH_PDF_ORIGINAL = '1606c86b2c8c651b7b2916d4766d1d4bc5e89017a59d8b40c36fabea080212e9'
const NOME_ARQUIVO = 'fechamento-2026-08-funcional.html.gz'
const LIMITE = 8_000_000
const caminho = (empresa: string) => `${empresa}/${COMPETENCIA}/${NOME_ARQUIVO}`
const caminhoPdf = (empresa: string) => `${empresa}/${COMPETENCIA}/fechamento-original.pdf`
const jsonErro = (erro: string, status: number) => NextResponse.json({ erro }, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function autorizar(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return { erro: jsonErro('Sessão expirada. Entre novamente no Atlas.', 401), empresa: '' }
  if (u.role !== 'master' || u.empresa_id !== EMPRESA_ESQUADRIFACIO) {
    return { erro: jsonErro('Caderno da Consultoria reservado ao Master da Esquadrifácio.', 403), empresa: '' }
  }
  return { erro: null, empresa: u.empresa_id }
}

export async function GET(req: NextRequest) {
  const acesso = await autorizar(req)
  if (acesso.erro) return acesso.erro
  try {
    const pdf = req.nextUrl.searchParams.get('tipo') === 'pdf'
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(pdf ? caminhoPdf(acesso.empresa) : caminho(acesso.empresa))
    if (error || !data) {
      return jsonErro(pdf ? 'O PDF original ainda não foi importado.' : 'A prévia interativa ainda não foi importada.', 404)
    }
    const bytes = new Uint8Array(await data.arrayBuffer())
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': pdf ? 'application/pdf' : 'application/gzip',
        'Content-Disposition': pdf ? 'inline; filename="fechamento-agosto-2026.pdf"' : 'inline; filename="caderno-consultoria-2026-08.html.gz"',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (erro) {
    console.error('Erro ao carregar caderno privado da consultoria:', erro)
    return jsonErro('Não foi possível carregar o caderno da Consultoria.', 500)
  }
}

export async function POST(req: NextRequest) {
  const acesso = await autorizar(req)
  if (acesso.erro) return acesso.erro
  if (Number(req.headers.get('content-length') || 0) > LIMITE + 200_000) return jsonErro('Arquivo maior que o limite de publicação.', 413)
  try {
    const form = await req.formData()
    const arquivo = form.get('arquivo')
    if (!arquivo || typeof arquivo === 'string') {
      return jsonErro('Nenhum arquivo recebido. Selecione a prévia funcional em HTML.', 400)
    }
    if (arquivo.size > LIMITE || arquivo.size < 100_000) return jsonErro('Arquivo acima do limite ou vazio.', 413)
    const texto = Buffer.from(await arquivo.arrayBuffer())
    const hash = createHash('sha256').update(texto).digest('hex')
    const tipo = hash === HASH_PDF_ORIGINAL ? 'pdf' : hash === HASH_PREVIA_VALIDADA ? 'html' : null
    if (!tipo) return jsonErro('Arquivo não reconhecido. Use o PDF original do fechamento de agosto/2026 ou a prévia HTML aprovada.', 400)
    const dados = tipo === 'pdf' ? texto : gzipSync(texto, { level: 9 })
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(tipo === 'pdf' ? caminhoPdf(acesso.empresa) : caminho(acesso.empresa), dados, {
      contentType: tipo === 'pdf' ? 'application/pdf' : 'application/gzip',
      cacheControl: '0',
      upsert: true,
    })
    if (error) {
      console.error('Falha no armazenamento privado da consultoria:', error.message)
      return jsonErro('Erro ao guardar o caderno na área privada.', 500)
    }
    return NextResponse.json({ ok: true, competencia: COMPETENCIA, paginas: 33, tipo }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (erro) {
    console.error('Erro ao importar caderno privado:', erro)
    return jsonErro('Não foi possível importar a prévia aprovada.', 500)
  }
}
