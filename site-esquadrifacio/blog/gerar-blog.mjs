// Gera o blog estático da Esquadrifácio®.
// Em homologação, mostra rascunhos identificados. Em produção, SOMENTE conteúdo aprovado.
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const site = dirname(root)
const source = JSON.parse(readFileSync(join(root, 'artigos.json'), 'utf8'))
const safe = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const title = 'Blog de soluções | Esquadrifácio®'
const instagram = 'https://www.instagram.com/esquadrifacio/'
const whatsapp = 'https://wa.me/5517996361318?text=Ol%C3%A1!%20Li%20o%20blog%20da%20Esquadrif%C3%A1cio%20e%20gostaria%20de%20um%20or%C3%A7amento.'
const map = 'https://maps.app.goo.gl/SnZxkUvSYJLgceed6'

function validate(posts, mode) {
  if (!Array.isArray(posts) || posts.length === 0) throw new Error('Nenhum artigo cadastrado')
  const slugs = new Set()
  for (const post of posts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug || '') || slugs.has(post.slug)) throw new Error('Slug inválido ou duplicado: ' + post.slug)
    slugs.add(post.slug)
    if (!post.title || !post.description || !post.category || !post.intro || !Array.isArray(post.sections) || post.sections.length < 3) throw new Error('Artigo incompleto: ' + post.slug)
    if (!['rascunho', 'revisao', 'aprovado'].includes(post.status)) throw new Error('Status inválido: ' + post.slug)
    if (!/^assets\/[a-z0-9-]+\.webp$/.test(post.photo || '') || !post.photoAlt || !Number.isInteger(post.photoWidth) || !Number.isInteger(post.photoHeight) || post.photoWidth<=0 || post.photoHeight<=0) throw new Error('Imagem não permitida: ' + post.slug)
    for (const section of post.sections) if (!section.heading || !Array.isArray(section.paragraphs) || !section.paragraphs.length) throw new Error('Seção inválida: ' + post.slug)
    if (post.status === 'aprovado' && (post.revisaoTecnicaConfirmada !== true || !/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt || ''))) throw new Error('Artigo marcado como aprovado sem revisão técnica/data: ' + post.slug)
  }
  if (mode === 'producao' && !posts.some(post => post.status === 'aprovado' && post.revisaoTecnicaConfirmada === true)) {
    throw new Error('BLOG SEM ARTIGOS APROVADOS: revisão técnica obrigatória antes do lançamento')
  }
}

function header(active) {
  return '<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>' +
    '<header class="site-header"><a class="logo" href="/" aria-label="Esquadrifácio, início"><strong>ESQUADRI</strong>FÁCIO<sup>®</sup><small>Soluções em alumínio</small></a>' +
    '<nav aria-label="Navegação principal"><a href="/">Início</a><a href="/solucoes.html">Soluções</a><a href="/#projetos">Obras</a><a href="/blog/"' + (active ? ' aria-current="page"' : '') + '>Blog</a></nav>' +
    '<a class="small-cta" target="_blank" rel="noopener noreferrer" href="' + whatsapp + '">Orçamento ↗</a></header>'
}
function footer() {
  return '<footer class="site-footer"><div><strong>ESQUADRIFÁCIO®</strong><p>Esquadrias de alumínio sob medida em José Bonifácio e região.</p><address>Av. Leonel Guilherme Pereira, 775 · Residencial Veneza, José Bonifácio - SP</address></div>' +
    '<nav aria-label="Links de contato"><a href="/">Início</a><a href="/solucoes.html">Soluções</a><a href="' + instagram + '" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="' + map + '" target="_blank" rel="noopener noreferrer">Como chegar ↗</a><a href="/politica-de-privacidade.html">Privacidade</a></nav></footer>'
}
function shell(head, body, selected) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="theme-color" content="#FAFBF8">' + head + '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/blog/blog.css"></head><body>' +
    header(selected) + '<main id="conteudo">' + body + '</main>' + footer() + '</body></html>'
}
function articleCard(post, mode) {
  const preview = mode === 'homologacao' && post.status !== 'aprovado'
  return '<article class="article-card">' +
   '<a href="/blog/' + post.slug + '.html" class="card-image" aria-label="Ler ' + safe(post.title) + '"><img loading="lazy" src="/' + safe(post.photo) + '" alt="' + safe(post.photoAlt) + '" width="' + post.photoWidth + '" height="' + post.photoHeight + '"></a>' +
   '<div class="card-body"><p class="category">' + safe(post.category) + (preview ? ' · <span class="draft">Em revisão</span>' : '') + '</p>' +
   '<h2><a href="/blog/' + post.slug + '.html">' + safe(post.title) + '</a></h2><p>' + safe(post.description) + '</p>' +
   '<a class="read" href="/blog/' + post.slug + '.html">Ler artigo ↗</a></div></article>'
}
function blogIndex(posts, mode, origin) {
  const robots = mode === 'homologacao' ? '<meta name="robots" content="noindex,nofollow">' : ''
  const canonical = mode === 'producao' ? '<link rel="canonical" href="' + origin + '/blog/"><meta property="og:url" content="' + origin + '/blog/">' : ''
  const head = '<title>' + title + '</title><meta name="description" content="Guias e soluções sobre portas de correr, janelas, ripados, vidros e esquadrias de alumínio sob medida em José Bonifácio.">' +
    '<meta property="og:title" content="' + title + '"><meta property="og:type" content="website">' + robots + canonical
  const intro = '<section class="intro"><p class="eyebrow">Conteúdo que ajuda na sua obra</p><h1>Ideias, orientações e <em>soluções.</em></h1>' +
    '<p>Do primeiro orçamento à escolha dos acabamentos, reunimos explicações para ajudar você a decidir com mais clareza.</p></section>'
  const note = mode === 'homologacao' ? '<p class="staging-note">Conteúdos em preparação editorial: informações sujeitas à revisão técnica antes da publicação definitiva.</p>' : ''
  const content = '<section class="listing" aria-label="Artigos do blog">' + note + '<div class="article-grid">' + posts.map(p => articleCard(p, mode)).join('') + '</div></section>'
  return shell(head, intro + content, true)
}
function articleHTML(post, mode, origin) {
  const draft = mode === 'homologacao' && post.status !== 'aprovado'
  const robots = mode === 'homologacao' ? '<meta name="robots" content="noindex,nofollow">' : ''
  const canonical = mode === 'producao' ? '<link rel="canonical" href="' + origin + '/blog/' + post.slug + '.html">' +
    '<meta property="og:url" content="' + origin + '/blog/' + post.slug + '.html"><meta property="og:image" content="' + origin + '/' + post.photo + '">' : ''
  const head = '<title>' + safe(post.title) + ' | Esquadrifácio®</title><meta name="description" content="' + safe(post.description) + '">' +
    '<meta property="og:title" content="' + safe(post.title) + '"><meta property="og:type" content="article">' + robots + canonical
  const sections = post.sections.map((s, i) => '<section class="article-section" aria-labelledby="cap-' + (i + 1) + '">' +
    '<h2 id="cap-' + (i + 1) + '">' + safe(s.heading) + '</h2>' + s.paragraphs.map(p => '<p>' + safe(p) + '</p>').join('') +
    (Array.isArray(s.bullets) ? '<ul>' + s.bullets.map(v => '<li>' + safe(v) + '</li>').join('') + '</ul>' : '') + '</section>').join('')
  const info = draft ? '<div class="staging-note" role="note">Artigo em revisão técnica · Este texto ainda não está aprovado para publicação pública.</div>' : ''
  const body = '<article class="article"><div class="article-hero"><a class="back" href="/blog/">← Voltar ao blog</a>' +
    '<p class="eyebrow">' + safe(post.category) + '</p><h1>' + safe(post.title) + '</h1><p class="lead">' + safe(post.intro) + '</p>' + info + '</div>' +
    '<figure class="article-photo"><img src="/' + safe(post.photo) + '" alt="' + safe(post.photoAlt) + '" width="' + post.photoWidth + '" height="' + post.photoHeight + '"><figcaption>Projeto realizado pela Esquadrifácio®</figcaption></figure>' +
    '<div class="prose">' + sections + '<div class="article-cta"><h2>Vamos conversar sobre seu projeto?</h2><p>Envie as medidas aproximadas, fotos do local e sua cidade. Nossa equipe orienta os próximos passos.</p>' +
    '<a href="' + whatsapp + '" target="_blank" rel="noopener noreferrer">Solicitar orçamento pelo WhatsApp ↗</a></div>' +
    '<p class="disclaimer">Conteúdo informativo. Medidas finais, dimensionamentos e exigências de segurança devem ser avaliados para cada obra pelo responsável técnico.</p>' +
    '</div></article>'
  let jsonld = ''
  if (mode === 'producao') {
    const structured = JSON.stringify({'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.description,
      author:{'@type':'Organization',name:'Esquadrifácio'},publisher:{'@type':'Organization',name:'Esquadrifácio'},
      datePublished:post.publishedAt,image:origin + '/' + post.photo,
      mainEntityOfPage:origin + '/blog/' + post.slug + '.html'}).replace(/</g,'\\u003c')
    jsonld = '<script type="application/ld+json">' + structured + '</script>'
  }
  return {html:shell(head + jsonld, body, false),script:jsonld ? jsonld.slice(jsonld.indexOf('>') + 1, -9) : null}
}
function xmlEscape(s) {
  return safe(s).replace(/&#39;/g, '&apos;').replace(/&quot;/g, '&quot;')
}
export function gerarBlog({mode, output, origin = ''}) {
  if (!['homologacao','producao'].includes(mode)) throw new Error('Modo de blog inválido')
  validate(source.articles, mode)
  const posts = source.articles.filter(post => mode === 'homologacao' || (post.status === 'aprovado' && post.revisaoTecnicaConfirmada === true))
  const out = join(output, 'blog')
  mkdirSync(out,{recursive:true})
  cpSync(join(root, 'blog.css'),join(out,'blog.css'))
  writeFileSync(join(out,'index.html'), blogIndex(posts,mode,origin))
  const paths = ['/blog/']
  const cspHashes = []
  for (const post of posts) {
    const {html,script} = articleHTML(post,mode,origin)
    writeFileSync(join(out, post.slug + '.html'), html)
    paths.push('/blog/' + post.slug + '.html')
    if (script) cspHashes.push(createHash('sha256').update(script,'utf8').digest('base64'))
  }
  if (mode === 'producao') {
    const items = posts.map(p=>'<item><title>' + xmlEscape(p.title) + '</title><link>' + origin + '/blog/' + p.slug + '.html</link><guid isPermaLink="true">' +
      origin + '/blog/' + p.slug + '.html</guid><description>' + xmlEscape(p.description) + '</description><pubDate>' + new Date(p.publishedAt + 'T12:00:00Z').toUTCString() + '</pubDate></item>')
    const feed = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog de Soluções — Esquadrifácio</title>' +
      '<link>' + origin + '/blog/</link><description>Guias sobre esquadrias de alumínio sob medida.</description><language>pt-br</language>' +
      items.join('') + '</channel></rss>'
    writeFileSync(join(out,'feed.xml'),feed)
  }
  return {paths, cspHashes, count:posts.length}
}
