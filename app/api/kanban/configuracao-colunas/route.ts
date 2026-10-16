import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {QUADROS} from '@/lib/centralKanban'
export const dynamic='force-dynamic'
/** Leitura isolada das três bibliotecas de coluna. Não chama GET da Central,
 * cujo semeador poderia criar colunas padrão e violar o compromisso da prévia. */
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return NextResponse.json({erro:'Sessão inválida'},{status:401})
 try{
  const empresa=u.empresa_id
  const {data:acl,error:aclErro}=u.role==='master'?{data:[],error:null}:
   await db.from('kanban_layout_permissoes').select('quadro,nivel').eq('empresa_id',empresa).eq('usuario_id',u.id)
  if(aclErro)throw aclErro
  const nivel=new Map((acl||[]).map(x=>[x.quadro,x.nivel]))
  const permitido=(quadro:string)=>u.role==='master'||['consultar','gerenciar'].includes(nivel.get(quadro)||'oculto')
  const [central,comercial,setores]=await Promise.all([
   db.from('central_kanban_colunas').select('id,setor,nome,nome_exibicao,ordem,ordem_visual,personalizada').eq('empresa_id',empresa).order('ordem'),
   db.from('kanban_colunas').select('id,nome,nome_exibicao,ordem,ordem_visual,personalizada').eq('empresa_id',empresa).order('ordem'),
   db.from('setor_kanban_colunas').select('id,setor_id,nome,nome_exibicao,ordem,ordem_visual,personalizada').eq('empresa_id',empresa).order('ordem'),
  ])
  if(central.error||comercial.error||setores.error)throw central.error||comercial.error||setores.error
  const cols=[...(central.data||[]).map(c=>({...c,nomeOperacional:c.nome,nome:c.nome_exibicao||c.nome,setor:'central:'+c.setor})),
   ...(comercial.data||[]).map(c=>({...c,nomeOperacional:c.nome,nome:c.nome_exibicao||c.nome,setor:'orcamento:comercial'})),
   ...(setores.data||[]).map(c=>({...c,nomeOperacional:c.nome,nome:c.nome_exibicao||c.nome,setor:'setor:'+c.setor_id}))]
  const nomes=new Map(QUADROS.map(q=>[q.id,q.nome]))
  const keys=[...new Set(cols.map(c=>c.setor))].filter(permitido)
  const quadros=keys.map(id=>{
   const [origem,setor]=id.split(':')
   const rotulo=nomes.get(setor as typeof QUADROS[number]['id'])||setor.replaceAll('-',' ')
   return{id,nome:(origem==='central'?'Central':origem==='orcamento'?'Orçamentos':'Setor')+' · '+rotulo}
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  if(!keys.length)return NextResponse.json({erro:'Nenhum Kanban foi liberado para seu usuário'},{status:403})
  return NextResponse.json({colunas:cols.filter(c=>permitido(c.setor)),quadros,usuarioMaster:u.role==='master',permissoes:Object.fromEntries(keys.map(k=>[k,u.role==='master'||nivel.get(k)==='gerenciar'?'administrar':'visualizar'])),
   aviso:'Salvar alterações registra somente o nome visível e a ordem de apresentação, preservando as regras das colunas originais.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[kanban preview]',e);return NextResponse.json({erro:'Não foi possível consultar a biblioteca de colunas'},{status:503})}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return NextResponse.json({erro:'Sessão inválida'},{status:401})
 try{
  const body=await req.json().catch(()=>null)
  if(!body||typeof body.quadro!=='string'||body.quadro.length>95||!Array.isArray(body.colunas)||body.colunas.length>45||body.colunas.length<1)
   return NextResponse.json({erro:'Informe quadro e colunas válidas'},{status:400})
  if(u.role!=='master'){
   const {data:permissao,error:ePermissao}=await db.from('kanban_layout_permissoes').select('nivel').eq('empresa_id',u.empresa_id)
    .eq('usuario_id',u.id).eq('quadro',body.quadro).maybeSingle()
   if(ePermissao)throw ePermissao
   if(permissao?.nivel!=='gerenciar')return NextResponse.json({erro:'Sem permissão de edição neste Kanban'},{status:403})
  }
  const linhas=body.colunas.map((c:unknown)=>{
   const v=c as {id?:unknown;nome?:unknown}
   return{id:String(v?.id||'').slice(0,100),nome:String(v?.nome||'').trim().slice(0,81)}
  })
  if(linhas.some((l:{id:string;nome:string})=>!l.id||l.nome.length<2||l.nome.length>80))
   return NextResponse.json({erro:'Identificadores e nomes inválidos'},{status:400})
  const {data,error}=await db.rpc('salvar_kanban_layout_visual_v1',{
   p_empresa:u.empresa_id,p_quadro:body.quadro,p_colunas:linhas,p_usuario:u.id
  })
  if(error){const msg=String(error.message||'Não foi possível salvar')
   const seguro=['Coluna','coluna','Quadro','quadro','Master','Número','nome','Nome','Empresa','empresa','UUID','Identificador']
   if(seguro.some(x=>msg.includes(x)))return NextResponse.json({erro:msg},{status:409})
   console.error('[kanban layout save]',error);return NextResponse.json({erro:'Não foi possível salvar as configurações com segurança'},{status:503})
  }
  return NextResponse.json({resultado:data},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[kanban layout POST]',e);return NextResponse.json({erro:'Falha ao salvar o Kanban'},{status:503})}
}
