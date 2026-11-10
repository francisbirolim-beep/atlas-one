const assert=require('node:assert/strict')
const fs=require('node:fs'),ts=require('typescript')
const compile=(file,imports)=> {
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
 }).outputText
 const mod={exports:{}}
 new Function('require','module','exports',js)(key=>{
  assert.ok(Object.hasOwn(imports,key),'Import não simulado: '+key)
  return imports[key]
 },mod,mod.exports)
 return mod.exports
}
const empresa='87897d68-1334-491c-b29b-4065cd83760c'
const venda='f21b0ce8-ea2a-424e-9a2f-04743eb47894'
const usuario='8e8153b2-044b-4002-8c27-63bc6a03690f'
const colunasMod=compile('lib/visaoGeralProjetos.ts',{})
const colunas=compile('lib/kanbanColunasSincronizadas.ts',{'./visaoGeralProjetos':colunasMod})
let linha={estado:'manual',coluna_visual_id:'aguardando',etapa_visual:'aguardando_materiais',updated_at:'2026-11-10T16:44:45Z'}
let persistir=true
let rpcCalls=0
const banco={
 from(tabela){
  const filtros={}
  const chain={
   select(){return chain},
   eq(col,v){filtros[col]=v;return chain},
   async maybeSingle(){
    if(filtros.empresa_id!==empresa)return{data:null,error:null}
    if(tabela==='vendas_obras')return{data:filtros.id===venda?{id:venda}:null,error:null}
    if(tabela==='visao_geral_cards_controle')
     return{data:filtros.venda_id===venda?linha:null,error:null}
    throw Error('Tabela desconhecida '+tabela)
   }
  }
  return chain
 },
 async rpc(fn,args){
  assert.equal(fn,'mover_card_principal_kanban_obra_coluna_v2')
  assert.equal(args.p_empresa,empresa)
  assert.equal(args.p_usuario,usuario)
  assert.equal(args.p_venda,venda)
  rpcCalls++
  if(persistir)linha={...linha,estado:'manual',coluna_visual_id:args.p_coluna_id,
   updated_at:'2026-11-10T17:00:00Z'}
  return{data:{ok:true,vendaId:venda,colunaId:args.p_coluna_id},error:null}
 }
}
const resp={json(data,opts={}){return{status:opts.status||200,body:data}}}
const imports={
 'next/server':{NextResponse:resp},
 '@/lib/comprasServer':{autenticarCompras:async()=>({id:usuario,empresa_id:empresa,role:'funcionario'})},
 '@/lib/kanbanObraPermissoesServer':{permissoesKanbanObra:async()=>({consultar:true,mover:true})},
 '@/lib/painelGeralAcessoServer':{podeMoverKanbanGeral:async()=>false,podeConsultarPainelGeral:async()=>false},
 '@/lib/supabaseAdmin':{supabaseAdmin:banco},
 '@/lib/visaoGeralProjetos':{ETAPAS_OPERACIONAIS:colunasMod.ETAPAS_OPERACIONAIS},
 '@/lib/kanbanColunasSincronizadas':{colunasKanbanEmpresa:colunas.colunasKanbanEmpresa},
}
const route=compile('app/api/visao-geral-projetos/mover/route.ts',imports)
;(async()=>{
 const req={json:async()=>({vendaId:venda,colunaId:'producao',motivo:'Mover para Produção conforme a obra'})}
 const gravado=await route.POST(req)
 assert.equal(gravado.status,200)
 assert.equal(gravado.body.ok,true)
 assert.equal(gravado.body.persistido,true)
 assert.equal(gravado.body.colunaId,'producao')
 const get=await route.GET({nextUrl:new URL('https://atlas.example/api/visao-geral-projetos/mover?vendaId='+venda)})
 assert.equal(get.status,200)
 assert.equal(get.body.colunaId,'producao')
 assert.equal(get.body.estado,'manual')
 // Os três quadros chamam o MESMO helper de posicionamento no servidor.
 const base={colunaId:'vendido',etapaOperacional:'vendido',vendaId:venda}
 const geral=colunas.posicionarCardVisual(base,linha,colunasMod.COLUNAS_GERAIS_PADRAO)
 const cliente=colunas.posicionarCardVisual(base,linha,colunasMod.COLUNAS_GERAIS_PADRAO)
 assert.equal(geral.colunaId,'producao')
 assert.equal(cliente.colunaId,'producao')
 const apiGeral=fs.readFileSync('app/api/visao-geral-projetos/route.ts','utf8')
 const apiCliente=fs.readFileSync('app/api/clientes/[id]/kanban-obras/route.ts','utf8')
 assert.ok(apiGeral.includes('posicoesPersistidas'))
 assert.ok(apiCliente.includes('posicoesPersistidas'))
 for(const p of ['app/visao-geral-projetos/page.tsx',
  'components/clientes/Cliente360KanbanObras.tsx','components/clientes/VendaKanbanObra.tsx']){
  const src=fs.readFileSync(p,'utf8')
  assert.ok(src.includes('posicoesPersistidas'),p+' não reaplica a posição ao atualizar')
  assert.ok(src.includes('/api/visao-geral-projetos/mover?vendaId='),p+' não confirma diretamente no banco')
 }
 // Nunca confirmar como sucesso se o RPC respondeu mas não gravou.
 persistir=false
 const falha=await route.POST({...req,json:async()=>({...await req.json(),colunaId:'compras'})})
 assert.equal(falha.status,409)
 assert.ok(!falha.body.ok)
 assert.equal(linha.coluna_visual_id,'producao')
 assert.equal(rpcCalls,2)
 console.log('PASS: POST confirma gravação real, GET devolve coluna persistida, ambos os Kanbans usam a mesma fonte, falso sucesso é rejeitado')
})().catch(e=>{console.error(e);process.exitCode=1})
