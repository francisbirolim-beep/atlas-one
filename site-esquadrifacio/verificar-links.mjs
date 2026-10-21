// Auditoria integral dos links e mídias do site + blog, sem qualquer conexão externa.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarBlog } from './blog/gerar-blog.mjs'
const root = dirname(fileURLToPath(import.meta.url))
const temp = mkdtempSync(join(tmpdir(), 'esquadrifacio-links-'))
const basePages = ['index.html', 'solucoes.html', 'politica-de-privacidade.html']
let count = {pages:0,links:0,internos:0,externos:0,ancoras:0,imagens:0}
const attr = (tag, name) => tag.match(new RegExp('\\b'+name+'="([^"]*)"', 'i'))?.[1]

try {
  const blog = gerarBlog({mode:'homologacao',output:temp})
  const blogPages = blog.paths.map(path => path.endsWith('/') ? path.slice(1)+'index.html' : path.slice(1))
  const pages = [...basePages,...blogPages]
  const lookup = p => p.startsWith('blog/') ? join(temp,p) : join(root,p)
  const contents = new Map(pages.map(file => [file,readFileSync(lookup(file),'utf8')]))
  count.pages = pages.length
  function localPath(dest) {
    let path=decodeURIComponent(dest.pathname)
    if (path.endsWith('/')) path += 'index.html'
    path=path.slice(1)
    const file=resolve(path.startsWith('blog/')?temp:root,path.startsWith('blog/')?path:path)
    const sourceRoot=path.startsWith('blog/')?temp:root
    assert.ok(file.startsWith(sourceRoot+sep),'Tentativa de path traversal: '+path)
    assert.ok(existsSync(file),'Destino ausente: '+path)
    return {path,file}
  }
  for(const [page,html] of contents){
    assert.ok(/<html\s+lang="pt-BR"/i.test(html),'Idioma pt-BR ausente '+page)
    assert.ok(/<title>[\s\S]+?<\/title>/.test(html),'Título ausente: '+page)
    assert.ok(/name="robots"\s+content="noindex,nofollow"/.test(html),'Prévia sem noindex: '+page)
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])
    assert.equal(ids.length,new Set(ids).size,'IDs duplicados '+page)
    for(const match of html.matchAll(/<a\b[^>]*>/gi)){
      count.links++
      const tag=match[0],href=attr(tag,'href')
      assert.ok(href,'Link sem href '+page)
      assert.ok(!/^(javascript|data|file):/i.test(href),'URL insegura '+href)
      const dest=new URL(href.replaceAll('&amp;','&'),'https://preview.invalid/'+page)
      if(dest.origin!=='https://preview.invalid'){
        count.externos++
        assert.equal(dest.protocol,'https:','Link externo sem https '+href)
        if(attr(tag,'target')==='_blank'){
          const rel=(attr(tag,'rel')||'').split(/\s+/)
          assert.ok(rel.includes('noopener')&&rel.includes('noreferrer'),'Link externo sem proteção '+href)
        }
      }else{
        count.internos++
        const target=localPath(dest)
        if(dest.hash){
          count.ancoras++
          const contentsTarget=contents.get(target.path)||readFileSync(target.file,'utf8')
          assert.ok(contentsTarget.includes('id="'+decodeURIComponent(dest.hash.slice(1))+'"'),'Âncora quebrada '+href)
        }
      }
    }
    for(const match of html.matchAll(/<img\b[^>]*>/gi)){
      count.imagens++
      const tag=match[0],src=attr(tag,'src')
      assert.ok(src,'Imagem sem src '+page)
      const dest=new URL(src,'https://preview.invalid/'+page)
      assert.equal(dest.origin,'https://preview.invalid','Imagem externa '+src)
      localPath(dest)
      assert.ok(attr(tag,'alt')?.trim(),'Imagem sem alt '+src)
      assert.ok(Number(attr(tag,'width'))>0&&Number(attr(tag,'height'))>0,'Imagem sem dimensões '+src)
    }
    for(const match of html.matchAll(/<link\b[^>]*>/gi)){
      const tag=match[0]
      if(['icon','preload','stylesheet'].includes(attr(tag,'rel'))){
        const href=attr(tag,'href')
        assert.ok(href,'Asset sem href '+page)
        localPath(new URL(href,'https://preview.invalid/'+page))
      }
    }
  }
  assert.ok(count.pages===7&&count.imagens===14&&count.links>=55&&count.ancoras>=10,'Quantidade inesperada de conteúdo')
  assert.ok(contents.get('index.html').includes('href="/blog/"'),'Home não leva ao blog')
  console.log('SITE_LINKS_OK — '+JSON.stringify(count))
}finally{rmSync(temp,{recursive:true,force:true})}
