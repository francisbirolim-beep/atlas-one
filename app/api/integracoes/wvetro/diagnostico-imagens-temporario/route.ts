import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const amostras = [
  'https://api.wvetro.com.br/wvetro/fotos/    0/SU-023.png',
  'https://api.wvetro.com.br/wvetro/fotos/    0/SU280D.png',
  'https://api.wvetro.com.br/wvetro/fotos/ 2705/TC-004.png',
  'https://api.wvetro.com.br/wvetro/fotos/01298/42-453/CB-276.png',
  'https://api.wvetro.com.br/wvetro/fotos/CAN-1.1/2".png',
  'https://api.wvetro.com.br/wvetro/fotos/DISC-WKR12"X1/8"X3/4.png',
]

function variantes(original: string) {
  const out = new Set<string>()
  out.add(original)
  out.add(encodeURI(original))

  const prefixo = 'https://api.wvetro.com.br/wvetro/fotos/'
  if (!original.startsWith(prefixo)) return [...out]
  const resto = original.slice(prefixo.length)

  // Normaliza espaços somente em pasta numérica, ex.: "    0" -> "0".
  const partes = resto.split('/')
  if (partes.length >= 2 && /^\s*\d+\s*$/.test(partes[0])) {
    const pasta = partes[0].trim()
    const arquivo = partes.slice(1).join('/')
    out.add(prefixo + pasta + '/' + arquivo)
    out.add(prefixo + pasta + '/' + encodeURIComponent(arquivo))
    out.add(prefixo + pasta + '/' + arquivo.replaceAll('/', '-'))
    out.add(prefixo + pasta + '/' + encodeURIComponent(arquivo.replaceAll('/', '-')))
  } else {
    out.add(prefixo + encodeURIComponent(resto))
    out.add(prefixo + resto.replaceAll('/', '-'))
    out.add(prefixo + encodeURIComponent(resto.replaceAll('/', '-')))
  }
  return [...out]
}

async function testar(url: string) {
  try {
    const resp = await fetch(url, { cache: 'no-store', redirect: 'follow' })
    const contentType = resp.headers.get('content-type')
    let bytes: number | null = null
    if (resp.ok && contentType?.toLowerCase().startsWith('image/')) {
      const buffer = await resp.arrayBuffer()
      bytes = buffer.byteLength
    }
    return { url, status: resp.status, ok: resp.ok, contentType, bytes, finalUrl: resp.url }
  } catch (e) {
    return { url, erro: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET() {
  const resultados = []
  for (const original of amostras) {
    const testes = []
    for (const url of variantes(original)) testes.push(await testar(url))
    resultados.push({ original, testes })
  }
  return NextResponse.json({ ok: true, resultados })
}
