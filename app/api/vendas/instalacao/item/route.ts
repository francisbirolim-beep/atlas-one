import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {disponibilidadePeca,validarRegistroInstalacao} from '@/lib/vendaInstalacaoProducao'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const estados=['pendente','em_instalacao','instalado','pendencia'] as const
type Estado=typeof estados[number]
const checks=['nivelamento','vedacao','acabamento','limpeza'] as const
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status})

export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body?.vendaId||'')
  const itemId=String(body?.itemId||'')
  if(!uuid.test(vendaId)||!uuid.test(itemId))return erro('Venda ou peça inválida.')
  const acao=String(body?.acao||'')
  if(!['quantidade','status','checklist','pendencia'].includes(acao))return erro('Alteração inválida.')

  const [vr,ir]=await Promise.all([
   supabaseAdmin.from('vendas_obras').select('id,orcamento_id,obra_id').eq('empresa_id',usuario.empresa_id).eq('id',vendaId).maybeSingle(),
   supabaseAdmin.from('venda_instalacao_itens').select('*').eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId).eq('id',itemId).maybeSingle(),
  ])
  if(vr.error)throw vr.error
  if(ir.error)throw ir.error
  if(!vr.data||!ir.data)return erro('Peça ou venda não localizada nesta empresa.',404)
  const item=ir.data
  const prevista=Number(item.quantidade||0)
  const existente=Number(item.quantidade_instalada||0)
  const patch:Record<string,unknown>={}
  let quantidade=existente
  let status=String(item.status||'pendente') as Estado
  if(acao==='quantidade'){
   quantidade=Number(body?.quantidade)
   // Instalação física concluída NÃO é conclusão da tipologia:
   // exige checklist integral, ausência de arremates pendentes e confirmação explícita.
   status=String(item.pendencia||'').trim()||quantidade>=prevista&&prevista>0?'pendencia':quantidade>0?'em_instalacao':'pendente'
   patch.quantidade_instalada=quantidade
   patch.status=status
   patch.instalado_em=null
  }else if(acao==='status'){
   if(!estados.includes(body?.status))return erro('Situação de instalação inválida.')
   status=body.status as Estado
   if(status==='instalado'){
    quantidade=prevista
    const chk={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{})}
    if(String(item.pendencia||'').trim())return erro('Há pendência de acabamento/instalação. Resolva a pendência antes de finalizar.',409)
    if(!checks.every(c=>chk[c]===true))return erro('Confirme nivelamento, vedação, acabamento e limpeza antes de finalizar.',409)
    if(!vr.data.obra_id)return erro('Vincule a obra antes de finalizar definitivamente a instalação.',409)
    patch.instalado_em=new Date().toISOString()
   }else if(status==='pendente')quantidade=0
   patch.status=status
   patch.quantidade_instalada=quantidade
   if(status!=='instalado')patch.instalado_em=null
  }else if(acao==='checklist'){
   const chave=String(body?.chave||'')
   if(!checks.some(c=>c===chave))return erro('Item do checklist inválido.')
   if(typeof body?.marcado!=='boolean')return erro('Informe a confirmação do checklist.')
   patch.checklist={nivelamento:false,vedacao:false,acabamento:false,limpeza:false,...(item.checklist||{}),[chave]:body.marcado}
   if(item.status==='instalado'&&!body.marcado){
    patch.status='pendencia'
    patch.instalado_em=null
   }
  }else{
   const texto=String(body?.pendencia||'').trim().slice(0,1000)
   patch.pendencia=texto||null
   patch.status=texto?'pendencia':quantidade>=prevista&&prevista>0?'pendencia':quantidade>0?'em_instalacao':'pendente'
   status=String(patch.status) as Estado
   if(texto)patch.instalado_em=null
  }

  // As fotos, pendências e checklist podem ser preparados antes da fabricação,
  // mas registrar peças instaladas exige produção física concluída.
  if(acao==='status'||acao==='quantidade'){
   const ordens=await supabaseAdmin.from('ordens_producao')
    .select('id,item_ref,tipo_producao,status,bloqueada,quantidade,quantidade_produzida')
    .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId).eq('item_ref',item.item_ref)
   if(ordens.error)throw ordens.error
   const disponibilidade=disponibilidadePeca(ordens.data||[],item.item_ref,prevista)
   const erroRegra=validarRegistroInstalacao({existente,novo:quantidade,status,quantidadePlanejada:prevista,disponibilidade})
   if(erroRegra)return NextResponse.json({error:erroRegra,disponibilidade},{status:409})
  }

  patch.atualizado_por_id=usuario.id
  patch.atualizado_por_nome=usuario.nome
  const atualizacao=await supabaseAdmin.from('venda_instalacao_itens').update(patch)
   .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId).eq('id',itemId)
   .select('*').single()
  if(atualizacao.error)throw atualizacao.error
  return NextResponse.json({ok:true,item:atualizacao.data})
 }catch(e){
  console.error('[Instalação][Peça]',e)
  return erro('Não foi possível atualizar a instalação. Confira o registro antes de repetir.',500)
 }
}
