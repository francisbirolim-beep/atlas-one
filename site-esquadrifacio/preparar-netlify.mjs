// Adaptador estático da Esquadrifácio® para Netlify; não faz deploy.
import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=dirname(fileURLToPath(import.meta.url))
const source=join(root,'.gerado','producao')
const dest=join(root,'.gerado','netlify-producao')
if(!existsSync(join(source,'sitemap.xml')))throw Error('Primeiro gere a versão de produção institucional')
const conf=JSON.parse(readFileSync(join(source,'vercel.json'),'utf8'))
if(existsSync(dest))rmSync(dest,{recursive:true,force:true})
cpSync(source,dest,{recursive:true})
rmSync(join(dest,'vercel.json'))
let result=''
for (const route of conf.headers||[]){
  const pattern=route.source==="/(.*)"?"/*":route.source.replaceAll("(.*)","*")
  result+=pattern+"\n"
  for(const {key,value} of route.headers||[]){
    if(key.toLowerCase()==='x-robots-tag')throw Error('Pacote público com bloqueio à indexação')
    result+='  '+key+': '+value+'\n'
  }
  result+='\n'
}
if(!result.includes('Content-Security-Policy:')||!result.includes("script-src 'sha256-"))throw Error('Cabeçalhos CSP ausentes')
writeFileSync(join(dest,'_headers'),result)
const sitemap=readFileSync(join(dest,'sitemap.xml'),'utf8')
const homepage=readFileSync(join(dest,'index.html'),'utf8')
const privacy=readFileSync(join(dest,'politica-de-privacidade.html'),'utf8')
if(!sitemap.includes('https://esquadrifacio.com.br/') ||
 !sitemap.includes('https://esquadrifacio.com.br/solucoes.html') ||
 !privacy.includes('Quem é responsável pelos dados')||
 /noindex|nofollow/i.test(homepage+privacy+result) ||
 /href="\/blog\/|id="blog"/.test(homepage)||
 existsSync(join(dest,'blog')) ||
 !readFileSync(join(dest,'robots.txt'),'utf8').includes('Allow: /')){
  throw Error('A compilação de produção contém bloqueio ou dados inválidos')
}
console.log('NETLIFY_BUILD_OK: '+dest)
