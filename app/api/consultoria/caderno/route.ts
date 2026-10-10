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
const NOME_ARQUIVO = 'fechamento-2026-08-funcional.html.gz'
const LIMITE = 4_350_000
const caminho = (empresa: string) => `${empresa}/${COMPETENCIA}/${NOME_ARQUIVO}`
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
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(caminho(acesso.empresa))
    if (error || !data) {
      return jsonErro('O caderno ainda não foi importado. Use o botão Importar prévia aprovada.', 404)
    }
    const bytes = new Uint8Array(await data.arrayBuffer())
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'inline; filename="caderno-consultoria-2026-08.html.gz"',
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
    if (!(arquivo instanceof File) || !arquivo.name.toLowerCase().endsWith('.html')) {
      return jsonErro('Selecione o arquivo HTML da prévia funcional aprovada.', 400)
    }
    if (arquivo.size > LIMITE || arquivo.size < 100_000) return jsonErro('Tamanho de arquivo inválido.', 413)
    const texto = Buffer.from(await arquivo.arrayBuffer())
    const hash = createHash('sha256').update(texto).digest('hex')
    if (hash !== HASH_PREVIA_VALIDADA) {
      return jsonErro('Este arquivo não é a prévia aprovada. Selecione Previa_Area_Consultoria_Atlas_One_FUNCIONAL.html.', 400)
    }
    const compactado = gzipSync(texto, { level: 9 })
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(caminho(acesso.empresa), compactado, {
      contentType: 'application/gzip',
      cacheControl: '0',
      upsert: true,
    })
    if (error) {
      console.error('Falha no armazenamento privado da consultoria:', error.message)
      return jsonErro('Erro ao guardar o caderno na área privada.', 500)
    }
    return NextResponse.json({ ok: true, competencia: COMPETENCIA, paginas: 33 }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (erro) {
    console.error('Erro ao importar caderno privado:', erro)
    return jsonErro('Não foi possível importar a prévia aprovada.', 500)
  }
}
