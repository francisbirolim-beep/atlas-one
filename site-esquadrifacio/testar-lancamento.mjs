// Testes do processo de lançamento: tudo executado em diretório temporário.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const pasta = dirname(fileURLToPath(import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'esquadrifacio-homologar-'))
let checks = 0
function check(name, test) { assert.ok(test, name); checks += 1 }
function checksum(bytes) { return createHash('sha256').update(bytes).digest('hex') }
function run(root, args) {
  return spawnSync(process.execPath, [join(root, 'preparar-publicacao.mjs'), ...args], { encoding: 'utf8' })
}
try {
  const copia = join(tmp, 'site')
  cpSync(pasta, copia, { recursive: true, filter: (source) => !source.includes('/.gerado') })
  const origemIndex = readFileSync(join(pasta, 'index.html'))
  const origemPrivacidade = readFileSync(join(pasta, 'politica-de-privacidade.html'))
  const aprovacao = JSON.parse(readFileSync(join(pasta, 'controle-lancamento.json'), 'utf8'))
  check('Fotos e domínio conferidos, publicação e privacidade bloqueadas', Object.values(aprovacao).length === 4 &&
    aprovacao.fotos_autorizadas === true && aprovacao.dominio_controlado === true &&
    ['privacidade_revisada','publicacao_autorizada'].every(k => aprovacao[k] === false))

  const staging = run(copia, ['--modo=homologacao'])
  check('Prévia construída', staging.status === 0)
  const saidaTeste = join(copia, '.gerado', 'homologacao')
  const htmlTeste = readFileSync(join(saidaTeste, 'index.html'), 'utf8')
  const solucoesTeste = readFileSync(join(saidaTeste, 'solucoes.html'), 'utf8')
  const confTeste = readFileSync(join(saidaTeste, 'vercel.json'), 'utf8')
  check('Prévia com bloqueio de busca', htmlTeste.includes('noindex,nofollow') && solucoesTeste.includes('noindex,nofollow') &&
    confTeste.includes('noindex, nofollow') &&
    readFileSync(join(saidaTeste, 'robots.txt'), 'utf8').includes('Disallow: /'))
  check('Prévia original mantida', checksum(origemIndex) === checksum(readFileSync(join(saidaTeste, 'index.html'))))
  check('Imagem original mantida', checksum(readFileSync(join(pasta, 'assets', 'porta-correr-integrada.webp'))) ===
    checksum(readFileSync(join(saidaTeste, 'assets', 'porta-correr-integrada.webp'))))
  const aprovada = readFileSync(join(copia, 'assets', 'porta-correr-integrada.webp'))
  writeFileSync(join(copia, 'assets', 'porta-correr-integrada.webp'), Buffer.concat([aprovada, Buffer.from('nao-autorizado')]))
  const alterada = run(copia, ['--modo=homologacao'])
  check('Alteração de foto aprovada bloqueia compilação', alterada.status !== 0 &&
    alterada.stderr.includes('FOTO MODIFICADA DEPOIS DA AUTORIZAÇÃO'))
  writeFileSync(join(copia, 'assets', 'porta-correr-integrada.webp'), aprovada)

  const bloqueado = run(copia, ['--modo=producao', '--dominio=https://esquadrifacio.com.br'])
  check('Produção impedida sem privacidade e publicação', bloqueado.status !== 0 &&
    bloqueado.stderr.includes('PUBLICAÇÃO BLOQUEADA') &&
    bloqueado.stderr.includes('revisão e aprovação dos textos de privacidade') &&
    !bloqueado.stderr.includes('autorização de divulgação de todas as fotos'))

  // Somente no diretório de teste! Nunca muda os registros aprovados pelo proprietário.
  writeFileSync(join(copia, 'controle-lancamento.json'), JSON.stringify({
    fotos_autorizadas: true, privacidade_revisada: true,
    dominio_controlado: true, publicacao_autorizada: true,
  }))
  const invalido = run(copia, ['--modo=producao', '--dominio=http://localhost:3000'])
  check('Bloqueio de domínio inseguro', invalido.status !== 0 && invalido.stderr.includes('domínio público'))
  const blogArquivo = join(copia, 'blog', 'artigos.json')
  const blogTodos = JSON.parse(readFileSync(blogArquivo, 'utf8'))
  const blogBloqueado = run(copia, ['--modo=producao', '--dominio=https://esquadrifacio.com.br'])
  check('Artigos não revisados impedem blog público', blogBloqueado.status !== 0 &&
    blogBloqueado.stderr.includes('BLOG SEM ARTIGOS APROVADOS'))
  blogTodos.articles[0].status = 'aprovado'
  blogTodos.articles[0].revisaoTecnicaConfirmada = true
  blogTodos.articles[0].publishedAt = '2026-10-21'
  writeFileSync(blogArquivo, JSON.stringify(blogTodos))
  const ok = run(copia, ['--modo=producao', '--dominio=https://esquadrifacio.com.br'])
  check('Candidato público gera arquivos apenas em sandbox', ok.status === 0)
  const pronto = join(copia, '.gerado', 'producao')
  const html = readFileSync(join(pronto, 'index.html'), 'utf8')
  const privacy = readFileSync(join(pronto, 'politica-de-privacidade.html'), 'utf8')
  const solucoes = readFileSync(join(pronto, 'solucoes.html'), 'utf8')
  const robots = readFileSync(join(pronto, 'robots.txt'), 'utf8')
  const sitemap = readFileSync(join(pronto, 'sitemap.xml'), 'utf8')
  const vercel = readFileSync(join(pronto, 'vercel.json'), 'utf8')
  const blogIndex = readFileSync(join(pronto, 'blog', 'index.html'), 'utf8')
  const blogArticle = readFileSync(join(pronto, 'blog', blogTodos.articles[0].slug + '.html'), 'utf8')
  const rss = readFileSync(join(pronto, 'blog', 'feed.xml'), 'utf8')
  check('Blog público somente com artigo simulado como aprovado', blogIndex.includes(blogTodos.articles[0].title) &&
    !blogIndex.includes(blogTodos.articles[1].title) && !blogIndex.includes(blogTodos.articles[2].title))
  check('Artigos possuem canonical e dados estruturados próprios', blogArticle.includes('rel="canonical" href="https://esquadrifacio.com.br/blog/') &&
    blogArticle.includes('application/ld+json') && !blogArticle.includes('noindex,nofollow'))
  check('RSS apenas com publicação aprovada', rss.includes(blogTodos.articles[0].title) &&
    !rss.includes(blogTodos.articles[1].title))

  check('Canonical público', html.includes('rel="canonical" href="https://esquadrifacio.com.br/"') &&
    privacy.includes('href="https://esquadrifacio.com.br/politica-de-privacidade.html"'))
  check('Soluções possuem canonical próprio', solucoes.includes('rel="canonical" href="https://esquadrifacio.com.br/solucoes.html"'))
  check('Imagem social com endereço completo', html.includes('property="og:image" content="https://esquadrifacio.com.br/assets/porta-correr-integrada.webp"'))
  check('Blog aprovado no sitemap, rascunhos privados', sitemap.includes('https://esquadrifacio.com.br/blog/') &&
    sitemap.includes('https://esquadrifacio.com.br/blog/' + blogTodos.articles[0].slug + '.html') &&
    !sitemap.includes(blogTodos.articles[1].slug))
  check('Mapa do site e robots vinculados', sitemap.includes('https://esquadrifacio.com.br/solucoes.html') && sitemap.includes('https://esquadrifacio.com.br/politica-de-privacidade.html') &&
    robots.includes('Sitemap: https://esquadrifacio.com.br/sitemap.xml') &&
    robots.includes('Allow: /'))
  check('Sem avisos de não indexação', !/noindex|nofollow/i.test(html + privacy + robots + vercel))
  check('Texto de privacidade sem indicação de homologação', !/homologa[cç][aã]o|revis[aã]o jur[ií]dica final pendente/i.test(privacy))
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  check('Dados estruturados da empresa válidos', !!m && JSON.parse(m[1]).address.addressLocality === 'José Bonifácio')
  const hash = createHash('sha256').update(m[1]).digest('base64')
  const a = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(blogArticle)
  const blogHash = createHash('sha256').update(a[1]).digest('base64')
  check('CSP admite apenas marcação estruturada verificada no blog', vercel.includes("'sha256-" + blogHash + "'"))

  check('CSP restringe script aos dados estruturados exatos', vercel.includes("'sha256-" + hash + "'"))
  check('Fotos copiadas sem modificação', checksum(readFileSync(join(pasta, 'assets', 'obra-porta-especial.webp'))) ===
    checksum(readFileSync(join(pronto, 'assets', 'obra-porta-especial.webp'))))
  check('Nenhum arquivo da prévia original reescrito', checksum(origemIndex) === checksum(readFileSync(join(pasta, 'index.html'))) &&
    checksum(origemPrivacidade) === checksum(readFileSync(join(pasta, 'politica-de-privacidade.html'))))
  console.log('SITE_LANCAMENTO_OK — ' + checks + ' verificações; sem deploy, DNS ou publicação.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

