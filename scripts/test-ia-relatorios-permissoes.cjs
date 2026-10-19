const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function load(file,imports={},extra=''){
 const module={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>{if(n in imports)return imports[n];if(n.startsWith('node:'))return require(n);throw Error('Import inesperado '+n+' em '+file)},console,Set,Map,Date,URL,URLSearchParams,process:{env:{}}})
 return module.exports
}
let config={crmEscopo:'proprios',acoes:{}},tables={},calls=[],failure=null
const user={id:'A',nome:'Mesmo Nome',empresa_id:'E',role:'funcionario'}
function reset(){tables={};calls=[];failure=null;config={crmEscopo:'proprios',acoes:{}}}
function from(table){
 const call={table,filters:[],op:'select'};calls.push(call)
 let singular=false,cap=Infinity,head=false,write=null,ordering=null
 const q={}
 q.select=(cols,opts={})=>{call.columns=cols;head=opts.head;return q}
 q.eq=(k,v)=>{call.filters.push(r=>r[k]===v);return q}
 q.in=(k,vs)=>{call.filters.push(r=>vs.includes(r[k]));return q}
 q.not=(k,op,v)=>{call.filters.push(r=>op==='is'?r[k]!==v:true);return q}
 q.is=(k,v)=>{call.filters.push(r=>r[k]===v);return q}
 q.gte=(k,v)=>{call.filters.push(r=>String(r[k])>=String(v));return q}
 q.lte=(k,v)=>{call.filters.push(r=>String(r[k])<=String(v));return q}
 q.contains=(k,obj)=>{call.contains=obj;call.filters.push(r=>Object.entries(obj).every(([key,val])=>r[k]?.[key]===val));return q}
 q.order=(k,opts={})=>{ordering=[k,opts.ascending!==false];return q}
 q.limit=n=>{cap=n;return q}
 for(const m of ['or','ilike','like','neq','range'])q[m]=()=>q
 for(const m of ['insert','upsert','update','delete'])q[m]=v=>{call.op=m;write=v;return q}
 const result=()=>{
  if(table===failure)return {data:null,error:{code:'OFFLINE',message:'simulated'},count:null}
  let rows=(tables[table]||[]).filter(r=>call.filters.every(f=>f(r)))
  if(write)rows=[{id:'created',...write}]
  if(ordering){const [k,asc]=ordering;rows=[...rows].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1))}
  return {data:head?null:singular?(rows[0]||null):rows.slice(0,cap),error:null,count:rows.length}
 }
 q.maybeSingle=async()=>{singular=true;return result()}
 q.single=q.maybeSingle
 q.then=(a,b)=>Promise.resolve(result()).then(a,b)
 return q
}
const db={from}
const next={NextResponse:{json:(data,o={})=>({data,status:o.status||200,headers:o.headers,json:async()=>data})}}
const pure=load('lib/ai/acessoDominio.ts')
const registry=load('lib/ai/specialists.ts')
const reads=()=>({lerAcessoConfigServer:async()=>{if(failure==='config')throw Error('config offline');return config}})
const ia=load('lib/ai/permissoesServer.ts',{
 '@/lib/supabaseAdmin':{supabaseAdmin:db},'@/lib/acessoUsuarioServer':reads(),'./specialists':registry,'./acessoDominio':pure,
})
const reportTypes=load('lib/relatoriosPermissoes.ts')
const reports=load('lib/relatoriosPermissoesServer.ts',{
 'next/server':next,'./supabaseAdmin':{supabaseAdmin:db},'./acessoUsuarioServer':reads(),'./relatoriosPermissoes':reportTypes,
})
function sectors(...ids){tables.permissoes=ids.map(id=>({empresa_id:'E',usuario_id:'A',setor_id:id,nivel:'edicao'}))}
function override(modulo,escopo,permitido=true){tables.ia_acessos_dominio=[...(tables.ia_acessos_dominio||[]),{empresa_id:'E',usuario_id:'A',dominio:modulo,escopo,permitido}]}
const global=load('lib/ai/contextoAtlasGlobal.ts',{
 '@/lib/supabaseAdmin':{supabaseAdmin:db},'@/lib/ai/permissoesServer':ia,'@/lib/ai/specialists':registry,
 '@/lib/ai/orcamentoEstimativaServer':{detectarConsultaEstimativaOrcamento:()=>({solicitado:false}),estimarOrcamentoHistorico:()=>{throw Error('Estimativa indevida')}},
},'\nexport { contextoComercial, contextoFinanceiro, contextoProducao, contextoRh, contextoEstoque, contextoCompras, contextoHistoricoWvetro, buscarTabela }')
const own={permitido:true,escopo:'proprio'}
let checks=0
function check(v,msg){assert.ok(v,msg);checks++}
async function run(){
 reset()
 for(const value of ['invalid','__proto__','constructor',null,42,''])check(pure.restringirEscopoIA('setor',{permitido:true,escopo:value})==='nenhum','Escopo inválido')
 check(pure.restringirEscopoIA('proprio',{permitido:true,escopo:'empresa'})==='proprio')
 sectors('crm','orcamentos','financeiro','relatorios','compras','producao','rh')
 let a=await ia.carregarPermissoesIA(user)
 check(a.dominios.comercial.escopo==='proprio')
 check(a.dominios.orcamento.escopo==='proprio')
 check(a.dominios.engenharia.permitido===false,'Setor oculto não libera IA')
 config.crmEscopo='todos'
 check((await ia.carregarPermissoesIA(user)).dominios.comercial.escopo==='setor','CRM todos permite leitura de setor sem ampliar teto')
 config.crmEscopo='proprios'
 const fingerprint=a.assinatura
 override('financeiro','nenhum')
 a=await ia.carregarPermissoesIA(user)
 check(!a.dominios.financeiro.permitido,'Override bloqueia especialista, geral e federação')
 check(a.assinatura!==fingerprint,'Mudança invalida sessão')
 override('producao','invalid')
 check(!(await ia.carregarPermissoesIA(user)).dominios.producao.permitido)
 config.acoes['ia.geral']='oculto'
 check(!(await ia.carregarPermissoesIA(user)).geral)
 config.acoes={}
 for(const fail of ['config','permissoes','ia_acessos_dominio']){
  failure=fail;await assert.rejects(()=>ia.carregarPermissoesIA(user));checks++
 }
 failure=null
 config.acoes['financeiro.contas_receber.consultar']='oculto'
 check(!(await ia.carregarPermissoesIA(user)).dominios.financeiro.permitido,'Ação de dados restringe IA')
 calls=[];check((await ia.carregarPermissoesIA({...user,role:'master'})).dominios.financeiro.escopo==='empresa')
 check(calls.length===0,'Master não depende de configuração restritiva')
 // Contagens e listas próprias são filtradas por UUID e empresa.
 reset()
 const owned={id:'own',empresa_id:'E',criado_por_id:'A',nome:'OWN',responsavel:'Mesmo Nome',created_at:'2026-10-10'}
 const other={id:'other',empresa_id:'E',criado_por_id:'B',nome:'OTHER',responsavel:'Mesmo Nome',created_at:'2026-10-10'}
 const tenant={...owned,id:'foreign',empresa_id:'OUTRA',nome:'FOREIGN'}
 for(const t of ['financeiro_contas_receber','financeiro_contas_pagar','ordens_producao','usuarios'])tables[t]=[owned,other,tenant]
 tables.usuarios=[{...owned,id:'A'},{...other,id:'B'},{...tenant,id:'C'}]
 let v=await global.contextoFinanceiro(user,own,[])
 check(v.total_titulos_receber===1&&v.contas_receber.length===1,'Totais financeiros próprios')
 check((await global.contextoProducao(user,own,[])).total_ordens===1)
 check((await global.contextoRh(user,own,[])).usuarios.length===1)
 calls=[];v=await global.contextoEstoque(user,own,[],true)
 check(v.saldos.length===0&&calls.length===0,'Sem titularidade de estoque não retorna saldo coletivo')
 tables.orcamentos=[{...owned,cliente_id:'C1'},{...other,cliente_id:'C2'},{...tenant,cliente_id:'C3'}]
 tables.clientes=[{...owned,id:'C1'},{...other,id:'C2'},{...tenant,id:'C3'}]
 v=await global.contextoComercial(user,own,[])
 check(v.clientes.length===1&&v.clientes[0].id==='C1','Nome repetido não dá acesso à carteira alheia')
 const scopes=Object.fromEntries(registry.AI_ESPECIALISTAS.map(e=>[e.modulo,{...own}]))
 calls=[];await global.contextoHistoricoWvetro(user,scopes,[],true)
 check(calls.length===0,'Escopo próprio não consulta histórico geral')
 calls=[];await global.buscarTabela({table:'sensitive',select:'*',searchColumns:[],termos:[],escopo:'proprio'})
 check(calls.length===0,'Titularidade ausente bloqueia antes da query')
 // Relatórios: autorização explícita, teto de setor, exportação e edição independentes.
 reset();sectors('relatorios','financeiro','compras','orcamentos','medida-final-msdwtt9y','venda-balcao')
 let r=await reports.carregarPermissoesRelatorios(user)
 check(!r.financeiro.consultar&&!r.esquadrifacio.consultar,'Legado Master não amplia automaticamente')
 check(r.comercial.consultar&&r.comercial.proprios)
 config.acoes['relatorios.financeiro.consultar']='consulta'
 r=await reports.carregarPermissoesRelatorios(user)
 check(r.financeiro.consultar&&!r.financeiro.editar)
 config.acoes['admin.bi.exportar']='oculto'
 check(!(await reports.carregarPermissoesRelatorios(user)).financeiro.exportar)
 let res=await reports.autorizarRelatorio({nextUrl:new URL('https://test.invalid/?finalidade=exportar')},user,'financeiro')
 check(res.status===403,'Exportação negada na API')
 config.acoes['relatorios.plano_contas.consultar']='edicao'
 check((await reports.carregarPermissoesRelatorios(user)).plano_contas.editar)
 tables.permissoes.find(x=>x.setor_id==='financeiro').nivel='consulta'
 check(!(await reports.carregarPermissoesRelatorios(user)).plano_contas.editar,'Consulta não edita')
 config.acoes['financeiro.geral.consultar']='oculto'
 check(!(await reports.carregarPermissoesRelatorios(user)).financeiro.consultar)
 calls=[];r=await reports.carregarPermissoesRelatorios({...user,role:'master'})
 check(r.esquadrifacio.consultar&&r.esquadrifacio.exportar&&r.plano_contas.editar&&calls.length===0)
 failure='config';res=await reports.autorizarRelatorio({nextUrl:new URL('https://test.invalid')},user,'financeiro');check(res.status===503)
 failure=null
 // Dados de resumo comercial não incluem outro vendedor nem outra empresa.
 reset()
 tables.orcamentos=[
  {id:'1',empresa_id:'E',criado_por_id:'A',created_at:'2026-10-10T15:00:00Z',valor_estimado:100,status:'convertido'},
  {id:'2',empresa_id:'E',criado_por_id:'B',created_at:'2026-10-10T15:00:00Z',valor_estimado:900,status:'convertido'},
  {id:'3',empresa_id:'OTHER',criado_por_id:'A',created_at:'2026-10-10T15:00:00Z',valor_estimado:500,status:'convertido'},
 ]
 const resumo=load('lib/relatoriosResumoServer.ts',{'./supabaseAdmin':{supabaseAdmin:db}})
 v=await resumo.carregarResumoComercial({inicio:'2026-10-01',fim:'2026-10-31'},user,true)
 check(v.totalOrcamentos===1&&v.valorOrcado===100&&v.ticketMedio===100)
 // Todos os endpoints de relatório bloqueiam antes de ler seus dados.
 for(const file of ['financeiro','obras-cmv','esquadrifacio','fornecedores','plano-contas','resumos']){
  let touched=false
  const rt=load('app/api/relatorios/'+file+'/route.ts',{
   'next/server':next,'@/lib/tenantServer':{autenticarTenant:async()=>user},
   '@/lib/relatoriosPermissoesServer':{autorizarRelatorio:async()=>next.NextResponse.json({error:'denied'},{status:403})},
   '@/lib/supabaseAdmin':{supabaseAdmin:{from:()=>{touched=true;throw Error('Read before authorization')}}},
   '@/lib/financeiroPlanoContas':{PLANO_CONTAS_PADRAO:[]},'@/lib/wvetroCmvResumo':{},
   '@/lib/vendaCmvLancamentos':{},'@/lib/relatorioFornecedores':{},'@/lib/relatoriosResumoServer':{},
  })
  const request={nextUrl:new URL('https://test.invalid/?tipo=comercial')}
  res=await rt.GET(request)
  check(res.status===403&&!touched,file+' nega antes das consultas')
  if(rt.POST){res=await rt.POST(request);check(res.status===403&&!touched,'Plano POST também nega')}
 }
 // Plano readonly não semeia nem grava.
 reset();tables.financeiro_plano_contas=[{id:'pc',codigo:'1'}]
 const plano=load('app/api/relatorios/plano-contas/route.ts',{
  'next/server':next,'@/lib/tenantServer':{autenticarTenant:async()=>user},'@/lib/supabaseAdmin':{supabaseAdmin:db},
  '@/lib/financeiroPlanoContas':{PLANO_CONTAS_PADRAO:[{codigo:'2'}]},
  '@/lib/relatoriosPermissoesServer':{autorizarRelatorio:async()=>null},
 })
 res=await plano.GET({nextUrl:new URL('https://test.invalid/?inicio=2026-10-01&fim=2026-10-31')})
 check(res.status===200&&!calls.some(c=>c.op!=='select'),'Plano de consulta não escreve')
 await testarAprendizado()
 await testarRotasIA()
 console.log('PASS:',checks,'verificações de autorização, escopos, dados e rotas.')
}

async function testarRotasIA(){
 const req=body=>({url:'https://test.invalid/api/ia/especialista',headers:{get:()=> 'Bearer fake'},json:async()=>body,nextUrl:new URL('https://test.invalid')})
 let providerCalls=[],estimateCalls=0,authUser=user
 const provider={statusOpenCode:async()=>({}),consultarOpenCode:async args=>{providerCalls.push(args);return {resposta:'Resultado permitido',sessionId:'nova',providerId:'fake',modelId:'fake'}}}
 const estimate={
  detectarConsultaEstimativaOrcamento:()=>({solicitado:true}),
  estimarOrcamentoHistorico:async()=>{estimateCalls++;return null},
  formatarEstimativaOrcamento:()=> 'estimativa',
 }
 const specialistImports={
  'next/server':next,'@/lib/supabaseAdmin':{supabaseAdmin:db},
  '@/lib/tenantServer':{autenticarTenant:async()=>authUser},
  '@/lib/ai/permissoesServer':ia,'@/lib/ai/specialists':registry,
  '@/lib/ai/opencode':provider,'@/lib/ai/fallbackInterno':{},
  '@/lib/ai/contextoAtlasGlobal':global,'@/lib/ai/orcamentoEstimativaServer':estimate,
  '@/lib/ai/pesquisaPublica':{podePesquisarPublicamente:()=>false},'@/lib/ai/auditoria':{registrarUsoIA:async()=>{}},
 }
 const specialist=load('app/api/ia/especialista/route.ts',specialistImports,'\nexport { validarSessao }')
 reset();sectors('orcamentos')
 let res=await specialist.POST(req({modulo:'financeiro',pergunta:'Contas'}))
 check(res.status===403&&providerCalls.length===0&&!calls.some(c=>c.op!=='select'),'Especialista nega antes de provedor e gravação')
 config.acoes['ia.geral']='oculto';calls=[]
 res=await specialist.POST(req({modulo:'orcamento',pergunta:'Orçamento'}))
 check(res.status===403&&!calls.some(c=>c.op!=='select'),'IA geral bloqueia especialista')
 config.acoes={};providerCalls=[];calls=[]
 tables.orcamentos=[
  {id:'own',empresa_id:'E',criado_por_id:'A',cliente_nome:'CLIENTE_PERMITIDO',created_at:'2026-10-10'},
  {id:'other',empresa_id:'E',criado_por_id:'B',cliente_nome:'FORBIDDEN_OTHER_OWNER',created_at:'2026-10-10'},
 ]
 tables.ai_interacoes=[{id:'old',empresa_id:'E',usuario_id:'A',contexto:'especialista:orcamento',contexto_json:{opencode_session_id:'antiga',permissoes_assinatura:'antiga'}}]
 check(await specialist.validarSessao(user,'orcamento','antiga')===null,'Sessão anterior à autorização atual não é reutilizada')
 const fingerprint=(await ia.carregarPermissoesIA(user)).assinatura
 tables.ai_interacoes.push({id:'current',empresa_id:'E',usuario_id:'A',contexto:'especialista:orcamento',contexto_json:{opencode_session_id:'permitida',permissoes_assinatura:fingerprint}})
 check(await specialist.validarSessao(user,'orcamento','permitida')==='permitida','Sessão com permissão vigente é preservada')
 res=await specialist.POST(req({modulo:'orcamento',pergunta:'Estimativa porta',sessionId:'antiga'}))
 check(res.status===200,'Especialista próprio responde com contexto autorizado')
 check(estimateCalls===0,'Atalho histórico não ignora escopo próprio')
 check(providerCalls.length===1&&providerCalls[0].sessionId===null)
 check(providerCalls[0].prompt.includes('CLIENTE_PERMITIDO')&&!providerCalls[0].prompt.includes('FORBIDDEN_OTHER_OWNER'),'Prompt contém só registros próprios')
 // Autorização das ferramentas reais, com consultas reais simuladas.
 const agente=load('lib/agente.ts',{
  './supabaseAdmin':{supabaseAdmin:db},'./ai/permissoesServer':ia,
  './recorrencia':{},'./ai/providerManager':{},'./ai/agentManager':{},'./ai/auditoria':{},'./ai/custo':{},
  './ai/baseTecnicaAgente':{},'./ai/pesquisaPublica':{},'./ai/specialists':registry,'./acessoUsuarioServer':{},
 })
 calls=[];let result=await agente.executarFerramenta('buscar_orcamentos',{},'A','funcionario','Mesmo Nome','E')
 check(result.orcamentos.length===1&&result.orcamentos[0].id==='own','Ferramenta geral usa titularidade')
 override('orcamento','nenhum');calls=[]
 result=await agente.executarFerramenta('buscar_orcamentos',{},'A','funcionario','Mesmo Nome','E')
 check(Boolean(result.erro)&&!calls.some(c=>c.table==='orcamentos'),'Ferramenta obedece bloqueio do domínio')
 reset();sectors('orcamentos');providerCalls=[]
 const general=load('app/api/agente/chat/route.ts',{
  'next/server':next,'@/lib/ai/permissoesServer':ia,'@/lib/supabaseAdmin':{supabaseAdmin:db},
  '@/lib/agente':{verificarUsuario:async()=>authUser,executarFerramenta:agente.executarFerramenta,usuarioPodeUsarFerramenta:agente.usuarioPodeUsarFerramenta,
   validarConversaAgente:async()=> 'CONV',obterOuCriarConversaHoje:async()=> 'CONV',criarConversaAgente:async()=> 'CONV',salvarMensagem:async()=>{}},
  '@/lib/ai/opencode':provider,'@/lib/ai/auditoria':{registrarUsoIA:async()=>{}},
  '@/lib/ai/orcamentoEstimativaServer':{...estimate,detectarConsultaEstimativaOrcamento:()=>({solicitado:false})},
  '@/lib/ai/documentoComparador':{extrairTextoDeAnexo:async()=>'',extrairItensComparacao:()=>[]},
 })
 config.acoes['ia.geral']='oculto';calls=[]
 res=await general.POST(req({mensagem:'Olá'}))
 check(res.status===403&&providerCalls.length===0&&!calls.some(c=>c.op!=='select'),'Geral bloqueada antes de consultas operacionais')
 config.acoes={};calls=[]
 const fingerprint2=(await ia.carregarPermissoesIA(user)).assinatura
 tables.ai_interacoes=[
  {id:'old',empresa_id:'E',usuario_id:'A',contexto:'atlas_ia_geral',pergunta:'Anterior',resposta:'FORBIDDEN_REVOKED_HISTORY',contexto_json:{conversa_id:'CONV',permissoes_assinatura:'old'},created_at:'2026-10-10'},
  {id:'new',empresa_id:'E',usuario_id:'A',contexto:'atlas_ia_geral',pergunta:'Permitida',resposta:'CURRENT_ALLOWED_HISTORY',contexto_json:{conversa_id:'CONV',permissoes_assinatura:fingerprint2},created_at:'2026-10-11'},
 ]
 res=await general.POST(req({mensagem:'Analise o contexto de forma detalhada',conversaId:'CONV',messages:[{role:'assistant',content:'FORBIDDEN_BODY_HISTORY'}]}))
 check(res.status===200&&providerCalls.length===1,'Geral mantém conversa permitida')
 check(providerCalls[0].prompt.includes('CURRENT_ALLOWED_HISTORY')&&!providerCalls[0].prompt.includes('FORBIDDEN_'),'Histórico enviado ao provedor vem do servidor e da permissão vigente')
 authUser=null;res=await specialist.POST(req({modulo:'financeiro',pergunta:'Dados'}));check(res.status===401)
}


async function testarAprendizado(){
 reset();sectors('engenharia','cadastro','compras')
 const source=load('app/api/ia/central-aprendizado/route.ts',{
  'next/server':next,'crypto':require('node:crypto'),'pdf-parse':()=>{},
  '@/lib/ai/permissoesServer':ia,'@/lib/supabaseAdmin':{supabaseAdmin:db},
  '@/lib/tenantServer':{autenticarTenant:async()=>user},
  '@/lib/ai/opencode':{},'@/lib/ai/specialists':registry,
  // O catálogo ganhou extratores puros em 17/10. Este teste verifica controle
  // de acesso e não analisa PDFs; manter extratores sem efeitos na sandbox VM.
  '@/lib/ai/catalogoPdfTexto':{textoCatalogoGeometrico:()=>''},
  '@/lib/ai/catalogoPeso':{pesoDecimalCatalogo:()=>null},
  '@/lib/ai/catalogoReanalise':{podeAtualizarCandidatoCatalogo:()=>false,dadosReanaliseCatalogo:(a)=>a||{}},
  '@/lib/ai/catalogoLinhas':{extrairLinhasCatalogo:()=>[],VERSAO_REGRAS_CATALOGO:'teste'},
  // Novos módulos somente de geometria/lote da publicação do catálogo. O teste
  // verifica permissões, por isso não interpreta imagens ou páginas reais.
  '@/lib/ai/catalogoCartoesGeometria':{extrairCartoesGeometricos:()=>[],codigoColadoDeOutrasColunas:()=>false},
  '@/lib/ai/catalogoPaginasSeguras':{indexarPaginasSeguras:()=>[]},
  '@/lib/ai/catalogoLoteSeguro':{avaliarCatalogoLote:()=>({})},
  '@/lib/ai/equivalenciaPerfilTecnico':{compararGeometria:()=>null,codigoPerfil:()=>null},
 },'\nexport {podeValidar,aplicar,processarCatalogoAutomatico}')
 check(await source.podeValidar(user,{tipo:'produto',modulo:'engenharia'}),'Edição autorizada aplica produto')
 config.acoes['admin.cadastros.produtos']='consulta'
 check(!await source.podeValidar(user,{tipo:'produto',modulo:'engenharia'}),'Consulta de cadastro não aplica produto')
 calls=[]
 await assert.rejects(()=>source.aplicar(user,{tipo:'produto',modulo:'engenharia'},{}),/Sem permissão/)
 check(!calls.some(c=>c.op!=='select'),'Bloqueio antes da escrita no catálogo')
 tables.ai_aprendizado_entradas=[{id:'ENTRADA',empresa_id:'E',criado_por_id:'A',tipo:'catalogo'}]
 tables.ai_aprendizado_candidatos=[{id:'C',entrada_id:'ENTRADA',empresa_id:'E',tipo:'produto',modulo:'engenharia',status:'pendente'}]
 calls=[]
 const resultado=await source.processarCatalogoAutomatico(user,'ENTRADA')
 check(resultado.aplicados===0&&resultado.pendentes===1,'Catálogo sem edição continua pendente, sem aplicar')
 check(!calls.some(c=>['produtos','fornecedores','produto_fornecedores'].includes(c.table)&&c.op!=='select'),'Não grava destinos sem autorização')
 const es=load('lib/iaRelatoriosAcoes.ts',{'./ai/specialists':registry,'./relatoriosPermissoes':reportTypes})
 check(es.IDS_IA_RELATORIOS.includes('ia.geral')&&es.IDS_IA_RELATORIOS.includes('relatorios.financeiro.consultar'),'Editor possui controles persistidos por ação')
}

run().catch(e=>{console.error(e);process.exitCode=1})
