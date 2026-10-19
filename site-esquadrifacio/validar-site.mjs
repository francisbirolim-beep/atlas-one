// Verificações sem rede da homepage institucional em homologação.
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
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
const fotos = ['porta-correr-integrada', 'painel-ripado-amadeirado', 'porta-entrada-amadeirada',
 'fachada-esquadrias-vidro', 'ambiente-acabamento-amadeirado', 'obra-painel-ripado',
 'obra-fachada-residencial', 'obra-porta-especial']
check('oito fotografias WebP independentes, sem imagens embutidas', (home.match(/src="assets\/[^"]+\.webp"/g) || []).length === 8 && !home.includes('data:image/'))
for (const foto of fotos) {
 const imagem = readFileSync(join(root, 'assets', foto + '.webp'))
 check('WebP real: ' + foto, imagem.subarray(0, 4).toString() === 'RIFF' && imagem.subarray(8, 12).toString() === 'WEBP' && imagem.length > 1000)
}
check('HTML compacto para carregamento otimizado', statSync(join(root, 'index.html')).size < 80000)
check('imagem principal priorizada, demais sob demanda', home.includes('fetchpriority="high"') && (home.match(/loading="lazy"/g) || []).length >= 7)
check('tamanhos e decodificacao de imagens declarados', (home.match(/width="\d+" height="\d+"/g) || []).length === 8 && (home.match(/decoding="async"/g) || []).length === 8)
check('navegacao celular com orcamento', home.includes('class="mobile-quote"') && home.includes('safe-area-inset-bottom'))
check('acessibilidade e movimento reduzido', home.includes('class="skip-link"') && home.includes('prefers-reduced-motion'))
check('favicon com marca registrada', readFileSync(join(root,'favicon.svg'),'utf8').includes('®'))
check('sem bibliotecas externas para imagens ou rastreamento', !home.includes('<script src="https://'))

check('SEO institucional e geolocalização', home.includes('Esquadrias de alumínio sob medida em José Bonifácio') && home.includes('name="geo.region"'))
check('prévia bloqueada para buscadores', home.includes('name="robots" content="noindex,nofollow"') && robots.includes('Disallow: /'))
check('Instagram oficial no rodapé', home.includes('href="https://www.instagram.com/esquadrifacio/"') && home.includes('Instagram @esquadrifacio'))
check('endereço oficial no rodapé', home.includes('Av. Leonel Guilherme Pereira, 775') && home.includes('Residencial Veneza') && home.includes('CEP 15202-420'))
check('link da localização fornecida no Google Maps', home.includes('href="https://maps.app.goo.gl/SnZxkUvSYJLgceed6"'))
check('rota GPS da Esquadrifácio no Google Maps', home.includes('href="https://www.google.com/maps/dir/?api=1&amp;destination=-21.050927%2C-49.667694"') && home.includes('Como chegar ↗'))
check('destaque acessível para Instagram e GPS', (home.match(/class="footer-highlight"/g) || []).length === 2 && home.includes('aria-label="Como chegar à Esquadrifácio pelo Google Maps"'))
check('GPS rápido no menu mobile com acessibilidade', home.includes('class="mobile-location"') && home.includes('aria-label="Como chegar à Esquadrifácio: abrir rota no Google Maps"') && home.includes('flex:0 0 48px'))
check('rodapé com referência direta de localização', home.includes('class="footer-info" id="localizacao"'))
check('privacidade visualmente integrada à marca', privacidade.includes('background:#FAFBF8;color:#2B403F') && privacidade.includes('border-left:3px solid #649E94'))
check('privacidade com canais e endereço completos', privacidade.includes('CEP 15202-420') && privacidade.includes('maps.app.goo.gl/SnZxkUvSYJLgceed6') && privacidade.includes('instagram.com/esquadrifacio/'))

check('CTA principal conectado ao WhatsApp', (home.match(/https:\/\/wa\.me\/5517996361318/g) || []).length >= 3)
check('links externos protegidos', !/<a(?=[^>]*href="https:\/\/)(?![^>]*rel="noopener noreferrer")[^>]*>/i.test(home))
check('não sobrou modal de demonstração', !home.includes('id="demo-modal"') && !home.includes('data-contact'))
check('não sobrou aviso público de protótipo', !home.includes('PRÉVIA NÃO PUBLICADA') && !home.includes('Prévia conceitual'))
check('seções e chamadas comerciais presentes', home.includes('Nossas obras') && home.includes('Solicitar orçamento'))
check('página de privacidade local vinculada', home.includes('href="/politica-de-privacidade.html"') && privacidade.includes('Lei Geral de Proteção de Dados'))
check('sem formulários ou rastreadores embutidos', !/<form\b/i.test(home) && !/googletagmanager|google-analytics|facebook\.net\/en_US\/fbevents/i.test(home))
check('política clara de cabeçalhos', vercel.headers?.[0]?.headers?.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff'))
check('conteudo protegido por CSP sem scripts', vercel.headers?.[0]?.headers?.some(h => h.key === 'Content-Security-Policy' && h.value.includes("script-src 'none'")))
check('robots tambem como cabecalho de homologacao', vercel.headers?.[0]?.headers?.some(h => h.key === 'X-Robots-Tag' && h.value.includes('noindex')))
check('cache de fotos configurado', vercel.headers?.some(x => x.source.includes('assets') && x.headers?.some(h => h.key === 'Cache-Control')))


const ids = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))
for (const [, destino] of home.matchAll(/href="#([^"]+)"/g)) {
  check('âncora interna válida: '+destino, ids.has(destino))
}

console.log('SITE_ESQUADRIFACIO_OK — '+checagens.length+' verificações')
