// Verificações sem rede da homepage institucional em homologação.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const home = readFileSync(join(root, 'index.html'), 'utf8')
const privacidade = readFileSync(join(root, 'politica-de-privacidade.html'), 'utf8')
const robots = readFileSync(join(root, 'robots.txt'), 'utf8')
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const checagens = []

function check(nome, condicao) {
  assert.ok(condicao, nome)
  checagens.push(nome)
}

check('identidade Esquadrifácio®', home.includes('ESQUADRI</strong>FÁCIO') && home.includes('Esquadrifácio®'))
check('estrutura original preservada', ['id="inicio"', 'id="solucoes"', 'id="projetos"', 'id="sobre"', 'id="contato"'].every(x => home.includes(x)))
check('todas as oito fotografias preservadas', (home.match(/src="data:image\//g) || []).length === 8)
check('SEO institucional e geolocalização', home.includes('Esquadrias de alumínio sob medida em José Bonifácio') && home.includes('name="geo.region"'))
check('prévia bloqueada para buscadores', home.includes('name="robots" content="noindex,nofollow"') && robots.includes('Disallow: /'))
check('CTA principal conectado ao WhatsApp', (home.match(/https:\/\/wa\.me\/5517996361318/g) || []).length >= 3)
check('links externos protegidos', !/<a(?=[^>]*href="https:\/\/)(?![^>]*rel="noopener noreferrer")[^>]*>/i.test(home))
check('não sobrou modal de demonstração', !home.includes('id="demo-modal"') && !home.includes('data-contact'))
check('não sobrou aviso público de protótipo', !home.includes('PRÉVIA NÃO PUBLICADA') && !home.includes('Prévia conceitual'))
check('seções e chamadas comerciais presentes', home.includes('Nossas obras') && home.includes('Solicitar orçamento'))
check('página de privacidade local vinculada', home.includes('href="/politica-de-privacidade.html"') && privacidade.includes('Lei Geral de Proteção de Dados'))
check('sem formulários ou rastreadores embutidos', !/<form\b/i.test(home) && !/googletagmanager|google-analytics|facebook\.net\/en_US\/fbevents/i.test(home))
check('política clara de cabeçalhos', vercel.headers?.[0]?.headers?.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff'))

const ids = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))
for (const [, destino] of home.matchAll(/href="#([^"]+)"/g)) {
  check('âncora interna válida: '+destino, ids.has(destino))
}

console.log('SITE_ESQUADRIFACIO_OK — '+checagens.length+' verificações')
