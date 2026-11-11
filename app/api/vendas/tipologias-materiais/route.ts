import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioTemDelegacaoExplicitaServer } from '@/lib/acessoUsuarioServer'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const tipos=['perfil','contramarco','acessorio','vidro','outro']
const erro=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'private, no-store'}})
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return erro('Sessão inválida.',401)

 try{
  const modo=req.nextUrl.searchParams.get('modo')||'historico'
  if(modo==='permissoes'){
   const base={usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'portal-cliente'}
   const [substituir,aprovar]=await Promise.all([
    usuarioTemDelegacaoExplicitaServer({...base,acaoId:'clientes.portal.tipologias_substituir'}),
    usuarioTemDelegacaoExplicitaServer({...base,acaoId:'clientes.portal.tipologias_aprovar'})
   ])
   return NextResponse.json({substituir,aprovar},{headers:{'Cache-Control':'private, no-store'}})
  }
  if(modo==='catalogo'){
   const busca=String(req.nextUrl.searchParams.get('busca')||'').trim().replace(/[%_,()]/g,' ').slice(0,70)
   if(busca.length<2)return NextResponse.json({produtos:[]})
   const {data,error}=await supabaseAdmin.from('produtos').select('id,codigo,nome,categoria,unidade,tamanho_barra_mm,foto_url')
    .eq('empresa_id',u.empresa_id).eq('ativo',true)
    .or(`codigo.ilike.%${busca}%,nome.ilike.%${busca}%`).limit(35)
   if(error)throw error
   return NextResponse.json({produtos:data||[]},{headers:{'Cache-Control':'private, no-store'}})
  }
  if(modo==='imagens'){
   const codigos=[...new Set((req.nextUrl.searchParams.get('codigos')||'').split('|').map(x=>x.trim()).filter(Boolean))].slice(0,140)
   if(!codigos.length)return NextResponse.json({imagens:{}})
   const {data,error}=await supabaseAdmin.from('produtos').select('codigo,foto_url')
    .eq('empresa_id',u.empresa_id).eq('ativo',true).in('codigo',codigos).limit(200)
   if(error)throw error
   const imagens:Record<string,string>={}
   for(const p of data||[])if(p.foto_url&&p.codigo)imagens[String(p.codigo).trim().toUpperCase()]=p.foto_url
   return NextResponse.json({imagens},{headers:{'Cache-Control':'private, no-store'}})
  }
  const vendaId=req.nextUrl.searchParams.get('vendaId')||''
  const pacoteId=req.nextUrl.searchParams.get('pacoteId')||''
  const itemRef=req.nextUrl.searchParams.get('itemRef')||''
  if(!uuid.test(vendaId)||!uuid.test(pacoteId)||!itemRef||itemRef.length>150)return erro('Filtro inválido.')
  const {data:venda,error:vErr}=await supabaseAdmin.from('vendas_obras').select('id,orcamento_id')
   .eq('id',vendaId).eq('empresa_id',u.empresa_id).maybeSingle()
  if(vErr)throw vErr
  if(!venda)return erro('Venda não encontrada.',404)
  const {data:pacote,error:pErr}=await supabaseAdmin.from('pacotes_tecnicos').select('id')
   .eq('id',pacoteId).eq('empresa_id',u.empresa_id).eq('orcamento_id',venda.orcamento_id).maybeSingle()
  if(pErr)throw pErr
  if(!pacote)return erro('Pacote técnico indisponível.',404)
  const {data,error}=await supabaseAdmin.from('venda_tipologia_materiais_historico')
   .select('id,acao,justificativa,usuario_nome,created_at,antes,depois')
   .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId)
   .eq('pacote_id',pacoteId).eq('item_ref',itemRef).order('created_at',{ascending:false}).limit(60)
  if(error)throw error
  return NextResponse.json({historico:data||[]},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('[Tipologias][GET]',e);return erro('Não foi possível carregar a composição ou o histórico.',500)}
}
export async function POST(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return erro('Sessão inválida.',401)
 const b=await req.json().catch(()=>null)
 if(!b||!uuid.test(b.vendaId||'')||!uuid.test(b.pacoteId||'')||
    typeof b.itemRef!=='string'||!b.itemRef.trim()||b.itemRef.length>150||
    !['incluir','substituir','excluir','ajustar'].includes(b.acao)||
    (b.acao!=='incluir'&&!uuid.test(b.materialId||''))||
    typeof b.justificativa!=='string'||b.justificativa.trim().length<5||b.justificativa.length>1000)
    return erro('Informe a tipologia, a ação e a justificativa (mínimo 5 caracteres).')
 if(u.role!=='master'){
  if(b.acao!=='substituir')return erro('Esta operação técnica exige autorização Master.',403)
  try{
   const permitido=await usuarioTemDelegacaoExplicitaServer({
    usuarioId:u.id,role:u.role,empresaId:u.empresa_id,
    setorId:'portal-cliente',acaoId:'clientes.portal.tipologias_substituir'
   })
   if(!permitido)return erro('Substituição de perfis não autorizada para este usuário.',403)
  }catch{return erro('Não foi possível verificar a autorização técnica.',503)}
 }
 const novo=b.novo||{}
 if(b.acao!=='excluir'&&(!tipos.includes(novo.categoria)||typeof novo.descricao!=='string'||
   !novo.descricao.trim()||!Number.isFinite(Number(novo.quantidade_ajustada))||
   Number(novo.quantidade_ajustada)<=0||Number(novo.quantidade_ajustada)>1000000||
   (novo.produto_id&&!uuid.test(novo.produto_id))))
   return erro('Selecione um material, categoria e quantidade positiva.')
 if(u.role!=='master'){
  if(!['perfil','contramarco'].includes(novo.categoria))return erro('Esta autorização permite substituir somente perfis e contramarcos.',403)
  const {data:original,error:erroOriginal}=await supabaseAdmin.from('pacote_tecnico_materiais')
   .select('categoria').eq('empresa_id',u.empresa_id).eq('pacote_id',b.pacoteId)
   .eq('item_ref',b.itemRef).eq('id',b.materialId).eq('excluido',false).maybeSingle()
  if(erroOriginal)return erro('Não foi possível conferir o material original.',503)
  if(!original||!['perfil','contramarco'].includes(original.categoria))return erro('Somente perfis ativos desta tipologia podem ser substituídos.',403)
  if(!uuid.test(novo.produto_id||''))return erro('Escolha o perfil substituto no catálogo.',403)
  const {data:substituto,error:erroSubstituto}=await supabaseAdmin.from('produtos')
   .select('categoria,foto_url').eq('id',novo.produto_id).eq('empresa_id',u.empresa_id)
   .eq('ativo',true).maybeSingle()
  if(erroSubstituto)return erro('Não foi possível conferir o substituto.',503)
  if(!substituto||!['perfil','contramarco'].includes(substituto.categoria)||!substituto.foto_url)
   return erro('Selecione um perfil ativo com imagem técnica no catálogo.',403)
 }
 try{
  const {data,error}=await supabaseAdmin.rpc('fn_venda_tipologia_material_editar_v1',{
   p_empresa:u.empresa_id,p_venda:b.vendaId,p_pacote:b.pacoteId,
   p_item_ref:b.itemRef,p_acao:b.acao,p_material:b.acao==='incluir'?null:b.materialId,
   p_novo:b.acao==='excluir'?{}:novo,p_motivo:b.justificativa.trim(),
   p_usuario:u.id,p_usuario_nome:u.nome
  })
  if(error){
   const m=error.message||'Falha ao editar tipologia.'
   return erro(m,/compras|separação|ordem de produção|Kanban|Reverta|indisponível/i.test(m)?409:400)
  }
  return NextResponse.json({ok:true,resultado:data},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){console.error('[Tipologias][POST]',e);return erro('Falha inesperada ao editar tipologia.',500)}
}
