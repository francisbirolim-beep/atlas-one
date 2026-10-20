// Checagem offline de links, âncoras e recursos da versão estática.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pages = ['index.html', 'solucoes.html', 'politica-de-privacidade.html']
const sources = new Map(pages.map(file => [file, readFileSync(join(root, file), 'utf8')]))
let links = 0, internos = 0, externos = 0, ancoras = 0, imagens = 0

function atributo(tag, name) {
  return tag.match(new RegExp('\\b' + name + '="([^"]*)"', 'i'))?.[1]
}
function filePath(url) {
  let decoded = decodeURIComponent(url.pathname)
  if (decoded === '/') decoded = '/index.html'
  const file = resolve(root, '.' + decoded)
  assert.ok(file.startsWith(root + sep), 'Recurso fora da pasta do site: ' + decoded)
  assert.ok(existsSync(file), 'Recurso local não encontrado: ' + decoded)
  return decoded.slice(1)
}

for (const [page, html] of sources) {
  assert.ok(/<html\s+lang="pt-BR"/i.test(html), 'Idioma não declarado: ' + page)
  assert.ok(/<title>[\s\S]+?<\/title>/.test(html), 'Página sem título: ' + page)
  assert.ok(/name="robots"\s+content="noindex,nofollow"/.test(html), 'Homologação indexável: ' + page)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
  assert.equal(ids.length, new Set(ids).size, 'IDs repetidos: ' + page)

  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    links++
    const tag = match[0], href = atributo(tag, 'href')
    assert.ok(href, 'Link sem destino em ' + page)
    assert.ok(!/^(?:javascript|data|file):/i.test(href), 'Destino inseguro: ' + href)
    const dest = new URL(href.replaceAll('&amp;', '&'), 'https://preview.invalid/' + page)
    if (dest.origin !== 'https://preview.invalid') {
      externos++
      assert.equal(dest.protocol, 'https:', 'Link externo não protegido por HTTPS: ' + href)
      if (atributo(tag, 'target') === '_blank') {
        const rel = (atributo(tag, 'rel') || '').split(/\s+/)
        assert.ok(rel.includes('noopener') && rel.includes('noreferrer'), 'Link externo sem rel seguro: ' + href)
      }
      continue
    }
    internos++
    const file = filePath(dest)
    if (dest.hash) {
      ancoras++
      const target = decodeURIComponent(dest.hash.slice(1))
      const targetHtml = sources.get(file) || readFileSync(join(root, file), 'utf8')
      assert.ok(targetHtml.includes('id="' + target + '"'), 'Âncora sem destino: ' + href + ' em ' + page)
    }
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    imagens++
    const tag = match[0]
    const src = atributo(tag, 'src')
    assert.ok(src, 'Imagem sem src: ' + page)
    const target = new URL(src, 'https://preview.invalid/' + page)
    assert.equal(target.origin, 'https://preview.invalid', 'Imagem externa inesperada: ' + src)
    filePath(target)
    assert.ok(atributo(tag, 'alt')?.trim(), 'Imagem sem texto alternativo: ' + src)
    assert.ok(Number(atributo(tag, 'width')) > 0 && Number(atributo(tag, 'height')) > 0, 'Imagem sem dimensões: ' + src)
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0], rel = atributo(tag, 'rel'), href = atributo(tag, 'href')
    if (rel === 'icon' || rel === 'preload') {
      assert.ok(href, 'Recurso do cabeçalho sem href: ' + page)
      const target = new URL(href, 'https://preview.invalid/' + page)
      filePath(target)
    }
  }
}
assert.equal(imagens, 8, 'As oito fotografias aprovadas devem permanecer no site')
assert.ok(links >= 30 && internos >= 15 && externos >= 10 && ancoras >= 10, 'Cobertura de navegação inesperada')
assert.ok(sources.get('index.html').includes('href="/solucoes.html#ripados"'), 'Cartão de ripados sem link')
assert.ok(sources.get('index.html').includes('href="/solucoes.html#entradas"'), 'Cartão de entradas sem link')
assert.ok(sources.get('index.html').includes('href="/solucoes.html#fachadas"'), 'Cartão de fachadas sem link')
console.log('SITE_LINKS_OK — ' + pages.length + ' páginas, ' + links + ' links (' + internos +
  ' internos, ' + externos + ' externos), ' + ancoras + ' âncoras e ' + imagens + ' imagens')
