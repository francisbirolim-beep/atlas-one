const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const origemId='f2657082-2745-4b1b-86c7-acfded400a7a'
const destinoId='26dfd639-af8d-476d-85ec-f5dc2ca45ae0'
const cardId='c893f053-4a3a-4522-ac55-89b77de25af2'
const obraOrigem='233bb849-cdb0-4c18-98a2-dd93373ac2b5'
const obraDestino='9c67b3e7-e237-4ea7-9391-8803365918bd'
const outraObra='7c67b3e7-e237-4ea7-9391-8803365918be'
const timestamp='2026-11-03T13:43:43.767449+00:00'
const empresa='empresa-1'
const initialCard={
  id:cardId,empresa_id:empresa,cliente_id:origemId,cliente_nome:'VALDINEI NOEL DA COSTA',
  cliente_whatsapp:null,cidade:'José Bonifácio',obra_id:obraOrigem,numero:361,
  status:'rascunho',modo_entrada:'formulario',orcamento_finalizado_em:null,
  wvetro_fluxo:{},updated_at:timestamp,valor_estimado:1550.24,
  itens:[{foto_url:'https://atlas.test/foto.jpg',largura_mm:1250,altura_mm:1850}],
  anexos:[{url:'https://atlas.test/arquivo.pdf'}]
}
let card={...initialCard}
const clientes=[
 {id:origemId,empresa_id:empresa,nome:'VALDINEI NOEL (BRANCO)',ativo:true,whatsapp:null,telefone:null,cidade:null},
 {id:destinoId,empresa_id:empresa,nome:'VALDINEI NOEL DA COSTA',ativo:true,whatsapp:'17 98135-1550',telefone:'17 98135-1550',cidade:'José Bonifácio'},
]
const obras=[
 {id:obraOrigem,empresa_id:empresa,cliente_id:origemId,nome:'Casa nova',endereco:'Rua A'},
 {id:obraDestino,empresa_id:empresa,cliente_id:destinoId,nome:'CASA',endereco:'Rua B'},
 {id:outraObra,empresa_id:empresa,cliente_id:'outra-pessoa',nome:'Outra pessoa'},
]
let role='master', dependentes=[],historicos=[],updates=[]
const banco={orcamentos:()=>[card],clientes:()=>clientes,obras:()=>obras,historico:()=>historicos}

function consulta(tabela) {
  let filtros=[],kind='select',patch,config={}
  const q={
    select:(_cols,opts={})=>{config=opts;return q},
    eq:(col,val)=>{filtros.push(['eq',col,val]);return q},
    ilike:(col,term)=>{filtros.push(['ilike',col,term]);return q},
    order:()=>q,limit:()=>q,
    update:v=>{kind='update';patch=v;return q},
    insert:v=>{kind='insert';patch=v;return q},
    maybeSingle:async()=>executar(true),
    then:(resolve,reject)=>Promise.resolve(executar(false)).then(resolve,reject),
  }
  function executar(single) {
    const rows=(banco[tabela]?banco[tabela]():dependentes.filter(x=>x.tabela===tabela).map(x=>x.row))
      .filter(x=>filtros.every(([kind,col,val])=>{
        if(kind==='eq') return x[col]===val
        const normalized=String(val).replace(/\\([%_\\])/g,'$1').replace(/^%|%$/g,'').toLowerCase()
        return String(x[col]||'').toLowerCase().includes(normalized)
      }))
    if(kind==='insert'){
      if(tabela==='historico')historicos.push({...patch})
      return {data:patch,error:null}
    }
    if(kind==='update') {
      if(tabela==='orcamentos'&&rows.length) {card={...card,...patch};updates.push({...patch})}
      return {data:rows.length?{...card}:null,error:null}
    }
    if(config.head)return {data:null,error:null,count:rows.length}
    return {data:single?(rows[0]||null):rows,error:null,count:rows.length}
  }
  return q
}

class NextRequest {
  constructor(url,opts={}){
    this.nextUrl=new URL(url)
    this.headers={get:k=>opts?.headers?.[k]||null}
    this.body=opts?.body?JSON.parse(opts.body):{}
  }
  async json(){return this.body}
}
const NextResponse={json:(data,{status=200}={})=>({status,ok:status<400,json:async()=>data})}
const mod={exports:{}}
const source=fs.readFileSync('app/api/kanban/comercial/trocar-cliente/route.ts','utf8')
const ui=fs.readFileSync('components/system/KanbanPageFixed.tsx','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
vm.runInNewContext(js,{
  module:mod,exports:mod.exports,URL,console,Date,Buffer,
  require:name=>{
    if(name==='next/server')return {NextRequest,NextResponse}
    if(name==='@/lib/tenantServer')return {autenticarTenant:async()=>({id:'user',nome:'Master',role,empresa_id:empresa})}
    if(name==='@/lib/supabaseAdmin')return {supabaseAdmin:{from:consulta}}
    throw Error('Import inesperado '+name)
  },
})
const {GET,POST}=mod.exports
async function get(query) {
  const r=await GET(new NextRequest('https://atlas.test/api/kanban/comercial/trocar-cliente?'+query))
  return {status:r.status,data:await r.json()}
}
async function post(body) {
  const r=await POST(new NextRequest('https://atlas.test/api/kanban/comercial/trocar-cliente',{
    body:JSON.stringify(body)
  }))
  return {status:r.status,data:await r.json()}
}
function payload(p={}){return {
  cardId,clienteOrigemId:origemId,clienteId:destinoId,atualizadoEm:timestamp,
  novaObraId:obraDestino,motivo:'Cadastro antigo duplicado; corrigido após conferência.',
  confirmou:true,...p
}}

async function run(){
  assert(ui.includes('Trocar cliente vinculado'),'Botão deve aparecer no card')
  assert(ui.includes('Cadastro realmente vinculado'),'Prévia deve mostrar cliente real')
  const busca=await get('busca=Valdinei')
  assert.equal(busca.status,200)
  assert.equal(busca.data.clientes.length,2)
  let previa=await get('cardId='+cardId+'&clienteId='+destinoId)
  assert.equal(previa.status,200)
  assert.equal(previa.data.clienteAnterior.nome,'VALDINEI NOEL (BRANCO)')
  assert.equal(previa.data.nomeExibidoNoCard,'VALDINEI NOEL DA COSTA')
  assert.equal(previa.data.obrasDestino.length,1)
  assert.equal(previa.data.motivosBloqueio.length,0)
  assert.equal(updates.length,0,'Prévia sem escrita')
  let r=await post(payload({confirmou:false}))
  assert.equal(r.status,400,'Exige confirmação')
  r=await post(payload({motivo:'curto'}))
  assert.equal(r.status,400,'Exige justificativa')
  r=await post(payload({novaObraId:obraOrigem}))
  assert.equal(r.status,409,'Impede obra do cliente antigo')
  r=await post(payload({atualizadoEm:'2026-01-01T00:00:00Z'}))
  assert.equal(r.status,409,'Impede concorrência')
  role='funcionario'
  r=await post(payload())
  assert.equal(r.status,403,'Troca exclusiva do Master')
  role='master'
  dependentes=[{tabela:'financeiro_contas_receber',row:{id:'f-1',empresa_id:empresa,orcamento_id:cardId}}]
  r=await post(payload())
  assert.equal(r.status,409,'Impede contas financeiras pendentes')
  dependentes=[]
  r=await post(payload())
  assert.equal(r.status,200,JSON.stringify(r.data))
  assert.equal(card.cliente_id,destinoId)
  assert.equal(card.cliente_nome,'VALDINEI NOEL DA COSTA')
  assert.equal(card.cliente_whatsapp,'17 98135-1550')
  assert.equal(card.obra_id,obraDestino)
  assert.equal(card.valor_estimado,initialCard.valor_estimado)
  assert.equal(JSON.stringify(card.itens),JSON.stringify(initialCard.itens))
  assert.equal(JSON.stringify(card.anexos),JSON.stringify(initialCard.anexos))
  assert.equal(obras[0].cliente_id,origemId,'Obra antiga intocada')
  assert.equal(clientes[0].ativo,true,'Cadastro antigo não inativado automaticamente')
  assert.equal(updates.length,1,'Somente o card atualizado')
  assert.equal(historicos.length,1,'Histórico de correção registrado')
  assert(historicos[0].detalhes.includes('VALDINEI NOEL (BRANCO)'))
  assert(historicos[0].detalhes.includes('Cadastro antigo duplicado'))
  r=await post(payload())
  assert.equal(r.status,409,'Não permite repetir sobre cliente já trocado')
  console.log('PASS: origem real, busca, prévia sem gravação, Master, obra da empresa, concorrência, financeiro, valores/fotos/anexos e histórico')
}
run().catch(e=>{console.error(e);process.exitCode=1})