const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/kanban/route.ts','utf8')
const component = fs.readFileSync('components/system/KanbanPageFixed.tsx','utf8')
const empresa='empresa-teste'
const clienteId='cliente-correto'
const usuario={id:'usuario-master',nome:'MASTER',role:'master',empresa_id:empresa}
const cliente={id:clienteId,nome:'CLIENTE EXEMPLO'}
const target={
 id:'card-correto',empresa_id:empresa,cliente_id:clienteId,cliente_nome:cliente.nome,
 updated_at:'2026-11-03T11:00:00.000Z',wvetro_fluxo:{},valor_estimado:150,
 anexos:[{titulo:'Medidas da obra',url:'https://atlas.test/medidas.pdf'}],
 itens:[{id:'foto-um',foto_url:'https://atlas.test/medida.jpg',largura_mm:1200,altura_mm:1300,
  quantidade:1,tipo_medida:'final',descricao:'Medido na obra'}]
}
const fonte={
 id:'orc-wvetro',empresa_id:empresa,cliente_id:clienteId,cliente_nome:cliente.nome,
 updated_at:target.updated_at,modo_entrada:'wvetro_api',
 wvetro_fluxo:{origem:'wvetro_api',numero:'1255'},valor_estimado:200,
 margem_padrao_pct:null,margem_padrao_origem:null,margem_regra_cidade_id:null,
 tipo_esquadria:'outro',largura_mm:1000,altura_mm:1000,quantidade:1,
 anexos:[{titulo:'W.Vetro',url:'https://atlas.test/wvetro.pdf'}],
 itens:[{id:'fonte-um',largura_mm:1000,altura_mm:1000,quantidade:1,descricao:'Origem'}]
}
let card={...target}
let noCliente=false,conflito=false,consultaAPI=0,confirmacoesAPI=0,writes=[],consultaDoc=null
function query(tabela){
  const filtro={}
  let acao='select',payload
  const q={}
  q.select=()=>q
  q.eq=(campo,v)=>{filtro[campo]=v;return q}
  q.contains=()=>q
  q.update=p=>{acao='update';payload=p;return q}
  q.insert=p=>{acao='insert';payload=p;return q}
  q.single=async()=>executar()
  q.maybeSingle=async()=>executar()
  q.then=(resolve,reject)=>Promise.resolve(executar()).then(resolve,reject)
  function executar(){
    let data=null
    if(tabela==='empresas')data={slug:'esquadrifacio',ativo:true}
    else if(tabela==='clientes')data=cliente
    else if(tabela==='orcamentos')data=filtro.id==='orc-wvetro'?fonte:card
    if(acao!=='select'){
      writes.push({tabela,acao,payload,filtro})
      if(tabela==='orcamentos'&&filtro.id==='card-correto'&&acao==='update'){
        card={...card,...payload};data=card
      }
      if(tabela==='orcamentos'&&filtro.id==='orc-wvetro'&&acao==='update')data={...fonte,...payload}
      if(tabela==='historico')data=payload
    }
    return {data,error:null}
  }
  return q
}
class NextRequest{
  constructor(url,opts={}){this.nextUrl=new URL(url);this.headers={get:key=>opts.headers?.[key]||''};this.data=opts.body?JSON.parse(opts.body):{}}
  async json(){return this.data}
}
const NextResponse={json:(data,op={})=>({status:op.status||200,ok:!op.status||op.status<400,json:async()=>data})}
const mod={exports:{}}
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const deps={
 'next/server':{NextRequest,NextResponse},
 '@/lib/tenantServer':{autenticarTenant:async()=>usuario},
 '@/lib/supabaseAdmin':{supabaseAdmin:{from:query}},
 '@/lib/wvetroOperacionalConsultaServer':{consultarRecursoOperacionalWVetro:async()=>({})},
 '@/lib/wvetroMigracaoOperacionalServer':{transformarPayloadWVetroEmStaging:()=>({registros:[]})},
 '../sincronizar/route':{sincronizar:async()=>NextResponse.json({ok:true})},
 '@/lib/wvetroPdfAnexo':{anexosComPdfWVetro:(prev)=>prev},
 '@/lib/wvetroAcessoServer':{},
 '@/lib/wvetroClienteIdentidade':{nomesClientesCompativeis:(a,b)=>String(a).toUpperCase().trim()===String(b).toUpperCase().trim()},
 '@/lib/wvetroPacoteTecnicoServer':{materializarPacoteTecnicoWVetro:async()=>({ok:true})},
 '@/lib/wvetroPreservacaoSincronizacao':{houveConferenciaHumanaWVetro:()=>false},
 '../candidatos-cliente/route':{POST:async()=>NextResponse.json({})},
 '../sincronizar-numero/route':{POST:async req=>{
  const b=await req.json()
  if(b.acao==='consultar'){
    consultaAPI++
    return NextResponse.json({ok:true,numero:b.numero,nomeWVetro:cliente.nome,
      clienteAtlas:cliente,valor:200,quantidadeItens:1,origem:'Histórico do W.Vetro',
      compativel:true,conflito,data:'2026-10-20',
      tokenConferencia:'TOKEN-ASSINADO',existe:null})
  }
  confirmacoesAPI++
  if(b.tokenConferencia!=='TOKEN-ASSINADO'||b.confirmaNome!==cliente.nome)
    return NextResponse.json({error:'Token inválido'},{status:409})
  return NextResponse.json({ok:true,importado:true,orcamentoAtlasId:fonte.id})
 }}
}
vm.runInNewContext(js,{exports:mod.exports,module:mod,console,URL,Buffer,setTimeout,clearTimeout,
 process:{env:{WVETRO_EMPRESA_SLUG:'esquadrifacio'}},require:name=>{
  if(name in deps)return deps[name]
  if(name==='@/lib/wvetroValidacaoItemServer')return {validarItemImportadoWVetro:async()=>NextResponse.json({})}
  if(name==='@/lib/wvetroValorVendaValidacaoServer')return {conferirValorVendaImportadoWVetro:async()=>NextResponse.json({})}
  throw Error('Import inesperado: '+name)
 }})
const post=mod.exports.POST
async function api(acao,extra={}){
 const req=new NextRequest('https://atlas.example/api/integracoes/wvetro/orcamentos/kanban',{
  headers:{authorization:'Bearer teste'},
  body:JSON.stringify({acao,cardId:target.id,numeroWvetro:'1255',...extra})
 })
 const res=await post(req)
 return {status:res.status,body:await res.json()}
}
async function run(){
 assert(component.includes('Sincronizar por número W.Vetro'),'Novo botão visível no modal')
 assert(component.includes('Confirmar sincronização com este card'),'Confirmação obrigatória em tela')
 let r=await api('consultar_numero')
 assert.equal(r.status,200)
 assert.equal(r.body.numero,'1255')
 assert.equal(r.body.nomeCard,card.cliente_nome)
 assert.equal(r.body.tokenConferencia,'TOKEN-ASSINADO')
 assert.equal(writes.length,0,'Prévia nunca grava')
 assert.equal(confirmacoesAPI,0)
 r=await api('vincular_numero',{confirmaNumero:'1255',confirmaNome:cliente.nome,
  tokenConferencia:'TOKEN-ASSINADO',confirmouVinculo:true,cardAtualizadoEm:'ANTIGO'})
 assert.equal(r.status,409,'Card alterado após prévia é bloqueado')
 assert.equal(confirmacoesAPI,0)
 r=await api('vincular_numero',{confirmaNumero:'1255',confirmaNome:cliente.nome,
  tokenConferencia:'TOKEN-ASSINADO',confirmouVinculo:false,cardAtualizadoEm:card.updated_at})
 assert.equal(r.status,400,'Sem confirmação expressa não vincula')
 assert.equal(confirmacoesAPI,0)
 conflito=true
 r=await api('consultar_numero')
 assert.equal(r.body.conflito,true,'Conflito de cliente é sinalizado')
 conflito=false
 noCliente=true
 card={...target,cliente_id:null}
 r=await api('consultar_numero')
 assert.equal(r.status,409,'Sem Cliente 360 não vincula por engano')
 card={...target}
 noCliente=false
 r=await api('vincular_numero',{confirmaNumero:'1255',confirmaNome:cliente.nome,
  tokenConferencia:'TOKEN-ASSINADO',confirmouVinculo:true,cardAtualizadoEm:card.updated_at})
 assert.equal(r.status,200,JSON.stringify(r.body))
 assert.equal(confirmacoesAPI,1)
 assert.equal(r.body.orcamento.id,target.id,'Atualiza o card, não troca de card')
 assert.equal(card.itens[0].foto_url,target.itens[0].foto_url,'Foto de obra preservada')
 assert.equal(card.itens[0].largura_mm,1200,'Medida final prevalece')
 assert(card.anexos.some(a=>a.url==='https://atlas.test/medidas.pdf'),'Anexo anterior preservado')
 assert.equal(card.wvetro_fluxo.numero,'1255','Número exato vinculado')
 assert(writes.some(w=>w.tabela==='historico'),'Ação auditada')
 console.log('PASS: busca exata sem gravação, token, confirmação, mudança concorrente, bloqueio sem cliente, 1:1 card, fotos/medidas/anexos e auditoria')
}
run().catch(e=>{console.error(e);process.exitCode=1})