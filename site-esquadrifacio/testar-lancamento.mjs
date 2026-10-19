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
  check('Todos os gates começam bloqueados', Object.values(aprovacao).length === 4 &&
    Object.values(aprovacao).every(x => x === false))

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
  const bloqueado = run(copia, ['--modo=producao', '--dominio=https://esquadrifacio.com.br'])
  check('Produção impedida sem quatro aprovações', bloqueado.status !== 0 && bloqueado.stderr.includes('PUBLICAÇÃO BLOQUEADA'))

  // Somente no diretório de teste! Nunca muda os registros aprovados pelo proprietário.
  writeFileSync(join(copia, 'controle-lancamento.json'), JSON.stringify({
    fotos_autorizadas: true, privacidade_revisada: true,
    dominio_controlado: true, publicacao_autorizada: true,
  }))
  const invalido = run(copia, ['--modo=producao', '--dominio=http://localhost:3000'])
  check('Bloqueio de domínio inseguro', invalido.status !== 0 && invalido.stderr.includes('domínio público'))
  const ok = run(copia, ['--modo=producao', '--dominio=https://esquadrifacio.com.br'])
  check('Candidato público gera arquivos apenas em sandbox', ok.status === 0)
  const pronto = join(copia, '.gerado', 'producao')
  const html = readFileSync(join(pronto, 'index.html'), 'utf8')
  const privacy = readFileSync(join(pronto, 'politica-de-privacidade.html'), 'utf8')
  const solucoes = readFileSync(join(pronto, 'solucoes.html'), 'utf8')
  const robots = readFileSync(join(pronto, 'robots.txt'), 'utf8')
  const sitemap = readFileSync(join(pronto, 'sitemap.xml'), 'utf8')
  const vercel = readFileSync(join(pronto, 'vercel.json'), 'utf8')
  check('Canonical público', html.includes('rel="canonical" href="https://esquadrifacio.com.br/"') &&
    privacy.includes('href="https://esquadrifacio.com.br/politica-de-privacidade.html"'))
  check('Soluções possuem canonical próprio', solucoes.includes('rel="canonical" href="https://esquadrifacio.com.br/solucoes.html"'))
  check('Imagem social com endereço completo', html.includes('property="og:image" content="https://esquadrifacio.com.br/assets/porta-correr-integrada.webp"'))
  check('Mapa do site e robots vinculados', sitemap.includes('https://esquadrifacio.com.br/solucoes.html') && sitemap.includes('https://esquadrifacio.com.br/politica-de-privacidade.html') &&
    robots.includes('Sitemap: https://esquadrifacio.com.br/sitemap.xml') &&
    robots.includes('Allow: /'))
  check('Sem avisos de não indexação', !/noindex|nofollow/i.test(html + privacy + robots + vercel))
  check('Texto de privacidade sem indicação de homologação', !/homologa[cç][aã]o|revis[aã]o jur[ií]dica final pendente/i.test(privacy))
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  check('Dados estruturados da empresa válidos', !!m && JSON.parse(m[1]).address.addressLocality === 'José Bonifácio')
  const hash = createHash('sha256').update(m[1]).digest('base64')
  check('CSP restringe script aos dados estruturados exatos', vercel.includes("'sha256-" + hash + "'"))
  check('Fotos copiadas sem modificação', checksum(readFileSync(join(pasta, 'assets', 'obra-porta-especial.webp'))) ===
    checksum(readFileSync(join(pronto, 'assets', 'obra-porta-especial.webp'))))
  check('Nenhum arquivo da prévia original reescrito', checksum(origemIndex) === checksum(readFileSync(join(pasta, 'index.html'))) &&
    checksum(origemPrivacidade) === checksum(readFileSync(join(pasta, 'politica-de-privacidade.html'))))
  console.log('SITE_LANCAMENTO_OK — ' + checks + ' verificações; sem deploy, DNS ou publicação.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

