// Construtor ESTÁTICO e offline. Não configura Vercel, DNS, banco ou integrações do Atlas.
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarBlog } from './blog/gerar-blog.mjs'

const pasta = dirname(fileURLToPath(import.meta.url))
const opcoes = new Map(process.argv.slice(2).map((arg) => {
  const match = /^--([a-z-]+)=(.*)$/.exec(arg)
  if (!match) throw new Error('Argumento inválido: ' + arg)
  return [match[1], match[2]]
}))
const modo = opcoes.get('modo') || 'homologacao'
if (!['homologacao', 'producao'].includes(modo)) throw new Error('Modo inválido')
const saida = join(pasta, '.gerado', modo)
const aprovacao = JSON.parse(readFileSync(join(pasta, 'controle-lancamento.json'), 'utf8'))

// A aprovação abrange apenas as oito fotografias existentes neste exato conjunto.
function conferirIntegridadeFotosAprovadas() {
  if (aprovacao.fotos_autorizadas !== true) return
  const manifesto = JSON.parse(readFileSync(join(pasta, 'autorizacao-fotos.json'), 'utf8'))
  if (!manifesto || !Array.isArray(manifesto.arquivos) || manifesto.arquivos.length !== 8) {
    throw new Error('MANIFESTO DE FOTOS INVÁLIDO: precisam constar exatamente oito arquivos')
  }
  const encontrados = readdirSync(join(pasta, 'assets')).filter(x => x.endsWith('.webp')).sort()
  const listados = manifesto.arquivos.map(x => x.arquivo).sort()
  if (encontrados.length !== 8 || listados.length !== 8 ||
      !encontrados.every((nome, i) => listados[i] === 'assets/' + nome)) {
    throw new Error('FOTOS DIFERENTES DAS APROVADAS: conferir licença e arquivos')
  }
  for (const item of manifesto.arquivos) {
    if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error('Hash inválido no manifesto das imagens aprovadas')
    }
    const original = readFileSync(join(pasta, item.arquivo))
    const hash = createHash('sha256').update(original).digest('hex')
    if (hash !== item.sha256) {
      throw new Error('FOTO MODIFICADA DEPOIS DA AUTORIZAÇÃO: ' + item.arquivo)
    }
  }
}


function confirmarCondicoes() {
  const entradas = [
    ['fotos_autorizadas', 'autorização de divulgação de todas as fotos'],
    ['privacidade_revisada', 'revisão e aprovação dos textos de privacidade'],
    ['dominio_controlado', 'controle comprovado do domínio pelo proprietário'],
    ['publicacao_autorizada', 'autorização expressa da publicação desta versão'],
  ]
  const faltantes = entradas.filter(([chave]) => aprovacao[chave] !== true).map(([, texto]) => texto)
  if (faltantes.length) throw new Error('PUBLICAÇÃO BLOQUEADA: ' + faltantes.join('; '))
}
function dominioPublico(value) {
  if (!value) throw new Error('Informe --dominio=https://dominio-registrado.com.br')
  let url
  try { url = new URL(value) } catch { throw new Error('Domínio inválido') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') || url.port ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(url.hostname) ||
      url.hostname.endsWith('.local') || url.hostname.includes('localhost')) {
    throw new Error('Use somente a origem HTTPS do domínio público, sem caminho ou parâmetros')
  }
  return url.origin
}
function inserirCabecalho(html, fragmento) {
  if (!html.includes('</head>')) throw new Error('HTML sem </head>')
  return html.replace('</head>', fragmento + '</head>')
}
function removerNoindex(html) {
  const atualizado = html
    .replace(/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']\s*\/?>/i, '')
  if (/noindex|nofollow/i.test(atualizado)) throw new Error('Indexação ainda bloqueada no HTML')
  return atualizado
}

let dominio = ''
if (modo === 'producao') {
  confirmarCondicoes()
  dominio = dominioPublico(opcoes.get('dominio'))
}
conferirIntegridadeFotosAprovadas()
if (existsSync(saida)) rmSync(saida, { recursive: true, force: true })
mkdirSync(saida, { recursive: true })
for (const name of ['index.html', 'solucoes.html', 'politica-de-privacidade.html', 'robots.txt', 'favicon.svg', 'vercel.json']) {
  cpSync(join(pasta, name), join(saida, name))
}
cpSync(join(pasta, 'assets'), join(saida, 'assets'), { recursive: true })
const blog = gerarBlog({mode:modo, output:saida, origin:dominio})

if (modo === 'producao') {
  const home = join(saida, 'index.html')
  const privacy = join(saida, 'politica-de-privacidade.html')
  const solutions = join(saida, 'solucoes.html')
  const origin = dominio
  let principal = removerNoindex(readFileSync(home, 'utf8'))
  let privacidade = removerNoindex(readFileSync(privacy, 'utf8'))
  let solucoes = removerNoindex(readFileSync(solutions, 'utf8'))
  const endereco = {
    '@type': 'PostalAddress',
    streetAddress: 'Avenida Leonel Guilherme Pereira, 775',
    addressLocality: 'José Bonifácio',
    addressRegion: 'SP',
    postalCode: '15202-420',
    addressCountry: 'BR',
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: 'Esquadrifácio',
    url: origin + '/',
    image: origin + '/assets/porta-correr-integrada.webp',
    telephone: '+55 17 99636-1318',
    address: endereco,
    geo: { '@type': 'GeoCoordinates', latitude: -21.050927, longitude: -49.667694 },
    sameAs: ['https://www.instagram.com/esquadrifacio/'],
    areaServed: { '@type': 'City', name: 'José Bonifácio' },
    hasMap: 'https://maps.app.goo.gl/SnZxkUvSYJLgceed6',
  }
  const jsonld = JSON.stringify(schema).replace(/</g, '\\u003c')
  const hash = createHash('sha256').update(jsonld, 'utf8').digest('base64')
  const social = [
    '<link rel="canonical" href="' + origin + '/"/>',
    '<meta property="og:url" content="' + origin + '/"/>',
    '<meta property="og:site_name" content="Esquadrifácio®"/>',
    '<meta property="og:image" content="' + origin + '/assets/porta-correr-integrada.webp"/>',
    '<meta property="og:image:alt" content="Esquadrias de alumínio sob medida da Esquadrifácio"/>',
    '<meta name="twitter:card" content="summary_large_image"/>',
    '<script type="application/ld+json">' + jsonld + '</script>',
  ].join('')
  principal = inserirCabecalho(principal, social)
  solucoes = inserirCabecalho(solucoes,
    '<link rel="canonical" href="' + origin + '/solucoes.html"/>' +
    '<meta property="og:url" content="' + origin + '/solucoes.html"/>' +
    '<meta property="og:image" content="' + origin + '/assets/porta-correr-integrada.webp"/>')
  privacidade = inserirCabecalho(privacidade,
    '<link rel="canonical" href="' + origin + '/politica-de-privacidade.html"/>')
  privacidade = privacidade.replace(
    'Texto de referência da versão em homologação. Revisão jurídica final pendente antes da publicação pública.',
    'Para informações sobre privacidade, utilize os canais de atendimento indicados nesta página.')
  if (/homologa[cç][aã]o|revis[aã]o jur[ií]dica final pendente/i.test(privacidade)) {
    throw new Error('Texto legal ainda contém aviso de homologação')
  }
  writeFileSync(home, principal)
  writeFileSync(privacy, privacidade)
  writeFileSync(solutions, solucoes)
  writeFileSync(join(saida, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + origin + '/sitemap.xml\n')
  writeFileSync(join(saida, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + origin + '/</loc></url>\n' +
    '  <url><loc>' + origin + '/solucoes.html</loc></url>\n' +
    '  <url><loc>' + origin + '/politica-de-privacidade.html</loc></url>\n' +
    blog.paths.map(path => '  <url><loc>' + origin + path + '</loc></url>\n').join('') +
    '</urlset>\n')
  const configuracao = JSON.parse(readFileSync(join(saida, 'vercel.json'), 'utf8'))
  for (const rota of configuracao.headers || []) {
    rota.headers = rota.headers.filter((h) => h.key.toLowerCase() !== 'x-robots-tag')
    for (const cabecalho of rota.headers) {
      if (cabecalho.key.toLowerCase() === 'content-security-policy') {
        cabecalho.value = cabecalho.value.replace("script-src 'none'",
          "script-src 'sha256-" + [hash,...blog.cspHashes].join("' 'sha256-") + "'")
      }
    }
  }
  writeFileSync(join(saida, 'vercel.json'), JSON.stringify(configuracao, null, 2) + '\n')
}
const html = readFileSync(join(saida, 'index.html'), 'utf8')
const conf = JSON.parse(readFileSync(join(saida, 'vercel.json'), 'utf8'))
const policy = JSON.stringify(conf.headers || [])
if (modo === 'homologacao') {
  if (!html.includes('noindex,nofollow') || !readFileSync(join(saida, 'solucoes.html'), 'utf8').includes('noindex,nofollow') || !policy.includes('noindex, nofollow') ||
      !readFileSync(join(saida, 'blog', 'index.html'), 'utf8').includes('noindex,nofollow') ||
      !readFileSync(join(saida, 'robots.txt'), 'utf8').includes('Disallow: /')) {
    throw new Error('A prévia de homologação perdeu o bloqueio aos buscadores')
  }
} else {
  if (/noindex|nofollow/i.test(html + readFileSync(join(saida, 'solucoes.html'), 'utf8') + policy) || !existsSync(join(saida, 'sitemap.xml'))) {
    throw new Error('Candidato público com configuração incorreta de indexação')
  }
}
console.log('SITE_BUILD_OK: ' + modo + ' -> ' + saida)
console.log('Este comando NÃO realiza deploy nem altera domínio.')

