// Confere a biblioteca do blog e sua versão estática de homologação.
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarBlog } from './gerar-blog.mjs'
const root = dirname(fileURLToPath(import.meta.url))
const site = dirname(root)
const manifest = JSON.parse(readFileSync(join(root, 'artigos.json'), 'utf8'))
let checks=0
function check(name,condition){assert.ok(condition,name);checks++}
const dir = mkdtempSync(join(tmpdir(),'blog-esquadrifacio-test-'))
try {
  check('três rascunhos de artigos iniciais',manifest.articles.length===3 && manifest.articles.every(x=>x.status==='rascunho'))
  check('nenhum artigo publicado sem aval técnico',manifest.articles.every(x=>x.revisaoTecnicaConfirmada!==true))
  const build=gerarBlog({mode:'homologacao',output:dir})
  check('blog e três artigos gerados',build.count===3 && build.paths.length===4)
  const index=readFileSync(join(dir,'blog','index.html'),'utf8')
  check('índice bloqueado de buscas e identificado como revisão',index.includes('noindex,nofollow')&&index.includes('Em revisão')&&index.includes('Conteúdos em preparação editorial'))
  const editor = readFileSync(join(dir,'blog','editorial','index.html'),'utf8')
  check('central editorial criada somente em homologação',editor.includes('Central <em>editorial.</em>') &&
    editor.includes('noindex,nofollow') && editor.includes('Área interna da prévia protegida'))
  check('central exibe dez pautas e três rascunhos',editor.includes('Próximas pautas') &&
    (editor.match(/class="editorial-row"/g)||[]).length===3 &&
    (editor.match(/class="editorial-n"/g)||[]).length===10)
  check('central editorial informa que não publica nem aprova',editor.includes('aprovações não são realizadas aqui') &&
    editor.includes('não grava automaticamente'))
  check('blog possui navegação e contatos reais',index.includes('href="/"')&&index.includes('href="/solucoes.html"')&&index.includes('instagram.com/esquadrifacio/')&&index.includes('maps.app.goo.gl/SnZxkUvSYJLgceed6'))
  check('blog sem carregamento de scripts de terceiros',!index.includes('<script') && !index.includes('googletagmanager'))
  for (const post of manifest.articles) {
    const html=readFileSync(join(dir,'blog',post.slug+'.html'),'utf8')
    check('artigo em revisão: '+post.slug,html.includes(post.title)&&html.includes('noindex,nofollow')&&html.includes('Artigo em revisão técnica')&&html.includes('Conteúdo informativo'))
    check('respostas e WhatsApp no artigo: '+post.slug,html.includes('5517996361318')&&html.includes('Solicitar orçamento'))
    check('imagem autorizada no artigo: '+post.slug,existsSync(join(site,post.photo))&&html.includes('src="/'+post.photo+'"')&&html.includes('alt="'+post.photoAlt+'"'))
    check('capítulos legíveis sem JS: '+post.slug,(html.match(/class="article-section"/g)||[]).length>=3&&!html.includes('<script'))
  }
  check('CSS da identidade da marca',readFileSync(join(dir,'blog','blog.css'),'utf8').includes('#FAFBF8')&&readFileSync(join(dir,'blog','blog.css'),'utf8').includes('#335956'))
  check('os rascunhos não possuem feed público',!existsSync(join(dir,'blog','feed.xml')))
  console.log('SITE_BLOG_OK — '+checks+' verificações; três rascunhos sem publicação')
}finally{rmSync(dir,{recursive:true,force:true})}
