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
  check('cinco rascunhos de artigos iniciais',manifest.articles.length===5 && manifest.articles.every(x=>x.status==='rascunho'))
  check('nenhum artigo publicado sem aval técnico',manifest.articles.every(x=>x.revisaoTecnicaConfirmada!==true))
  const build=gerarBlog({mode:'homologacao',output:dir})
  check('blog e cinco artigos gerados',build.count===manifest.articles.length && build.paths.length===manifest.articles.length+1)
  const index=readFileSync(join(dir,'blog','index.html'),'utf8')
  check('índice bloqueado de buscas e identificado como revisão',index.includes('noindex,nofollow')&&index.includes('Em revisão')&&index.includes('Conteúdos em preparação editorial'))
  const editor = readFileSync(join(dir,'blog','editorial','index.html'),'utf8')
  check('central editorial criada somente em homologação',editor.includes('Central <em>editorial.</em>') &&
    editor.includes('noindex,nofollow') && editor.includes('Área interna da prévia protegida'))
  check('central exibe oito pautas e cinco rascunhos',editor.includes('Próximas pautas') &&
    (editor.match(/class="editorial-row"/g)||[]).length===manifest.articles.length &&
    (editor.match(/class="editorial-n"/g)||[]).length===8)
  check('central editorial informa que não publica nem aprova',editor.includes('aprovações não são realizadas aqui') &&
    editor.includes('não grava automaticamente'))
  check('blog com destaque editorial, assuntos e leitura estimada',index.includes('Artigo em destaque') &&
    index.includes('Mais guias para explorar') &&
    (index.match(/class="reading-time"/g)||[]).length===manifest.articles.length &&
    (index.match(/class="article-card/g)||[]).length===manifest.articles.length)
  check('navegação por temas sem JavaScript',index.includes('class="topics"') &&
    manifest.articles.every(x=>index.includes('href="#artigo-'+x.slug+'"')) &&
    !index.includes('<script'))
  check('blog possui navegação e contatos reais',index.includes('href="/"')&&index.includes('href="/solucoes.html"')&&index.includes('instagram.com/esquadrifacio/')&&index.includes('maps.app.goo.gl/SnZxkUvSYJLgceed6'))
  check('blog sem carregamento de scripts de terceiros',!index.includes('<script') && !index.includes('googletagmanager'))
  for (const post of manifest.articles) {
    const html=readFileSync(join(dir,'blog',post.slug+'.html'),'utf8')
    check('artigo em revisão: '+post.slug,html.includes(post.title)&&html.includes('noindex,nofollow')&&html.includes('Artigo em revisão técnica')&&html.includes('Conteúdo informativo'))
    check('respostas e WhatsApp no artigo: '+post.slug,html.includes('5517996361318')&&html.includes('Solicitar orçamento'))
    check('imagem autorizada no artigo: '+post.slug,existsSync(join(site,post.photo))&&html.includes('src="/'+post.photo+'"')&&html.includes('alt="'+post.photoAlt+'"'))
    check('capítulos legíveis sem JS: '+post.slug,(html.match(/class="article-section"/g)||[]).length>=3&&!html.includes('<script'))
    check('sumário e perguntas frequentes: '+post.slug,html.includes('class="article-toc"')&&
      (html.match(/<details>/g)||[]).length===post.faq.length &&
      html.includes('id="perguntas-frequentes"'))
    check('guias relacionados e contato técnico: '+post.slug,html.includes('class="related"')&&
      html.includes('href="/solucoes.html')&&html.includes('Conteúdo informativo'))

  }
  check('CSS da identidade da marca',readFileSync(join(dir,'blog','blog.css'),'utf8').includes('#FAFBF8')&&readFileSync(join(dir,'blog','blog.css'),'utf8').includes('#335956'))
  check('os rascunhos não possuem feed público',!existsSync(join(dir,'blog','feed.xml')))
  console.log('SITE_BLOG_OK — '+checks+' verificações; '+manifest.articles.length+' rascunhos sem publicação')
}finally{rmSync(dir,{recursive:true,force:true})}
