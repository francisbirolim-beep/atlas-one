import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'
import { lerAcessoConfigServer } from './acessoUsuarioServer'
import type { UsuarioTenant } from './tenantServer'
import { RELATORIOS_PERMISSOES, type RelatorioId, type MapaRelatorios } from './relatoriosPermissoes'
const requisitos:Record<RelatorioId,Array<[string[],string]>>={
 obras:[[['orcamentos','fazer-orcamento-msanfyvj'],'comercial.orcamento.consultar'],[['compras'],'compras.geral.consultar'],[['financeiro'],'financeiro.geral.consultar']],
 comercial:[[['orcamentos','fazer-orcamento-msanfyvj'],'comercial.orcamento.consultar']],
 financeiro:[[['financeiro'],'financeiro.geral.consultar']],
 producao:[[['medida-final-msdwtt9y','medicao'],'producao.medida_final.consultar']],
 fornecedores:[[['compras'],'compras.geral.consultar']],
 esquadrifacio:[[['orcamentos','fazer-orcamento-msanfyvj'],'comercial.orcamento.consultar'],[['compras'],'compras.geral.consultar'],[['financeiro'],'financeiro.geral.consultar'],[['venda-balcao'],'comercial.balcao.consultar_preco']],
 plano_contas:[[['financeiro'],'financeiro.geral.consultar']],
 compras:[[['compras'],'compras.geral.consultar']],
 engenharia:[[['engenharia','mee'],'engenharia.geral.consultar']],
 assistencia:[[['assistencia-painel','pos-venda'],'clientes.assistencia.consultar']],
}
const explicitos=new Set<RelatorioId>(['obras','financeiro','esquadrifacio','plano_contas'])
const peso=(v:unknown)=>v==='edicao'?2:v==='consulta'?1:0
export async function carregarPermissoesRelatorios(u:UsuarioTenant):Promise<MapaRelatorios>{
 const resultado={} as MapaRelatorios
 if(u.role==='master'){
  for(const [id] of RELATORIOS_PERMISSOES)resultado[id]={consultar:true,editar:true,exportar:true,proprios:false}
  return resultado
 }
 const [config,p]=await Promise.all([
  lerAcessoConfigServer(u.id,u.empresa_id),
  supabaseAdmin.from('permissoes').select('setor_id,nivel').eq('empresa_id',u.empresa_id).eq('usuario_id',u.id),
 ])
 if(p.error)throw Error('Não foi possível conferir as permissões dos relatórios.')
 const setores=new Map((p.data||[]).map(x=>[String(x.setor_id),peso(x.nivel)]))
 const acoes=config?.acoes||{}
 const nivel=(ids:string[],acao:string)=>Math.min(Math.max(0,...ids.map(id=>setores.get(id)||0)),Object.hasOwn(acoes,acao)?peso(acoes[acao]):2)
 const bi=nivel(['relatorios'],'admin.bi.consultar')
 for(const [id] of RELATORIOS_PERMISSOES){
  const chave='relatorios.'+id+'.consultar'
  const especifico=Object.hasOwn(acoes,chave)?peso(acoes[chave]):explicitos.has(id)?0:2
  const dados=Math.min(...requisitos[id].map(([ids,a])=>nivel(ids,a)))
  let atual=Math.min(bi,especifico,dados)
  if(['financeiro','esquadrifacio','plano_contas'].includes(id)&&
   ['financeiro.contas_pagar.consultar','financeiro.contas_receber.consultar'].some(a=>Object.hasOwn(acoes,a)&&peso(acoes[a])===0))atual=0
  // Sem vínculo seguro de titularidade, não oferecer agregado geral a uma carteira própria.
  if((id==='obras'||id==='esquadrifacio')&&config?.crmEscopo!=='todos')atual=0
  resultado[id]={
   consultar:atual>0,
   editar:atual===2&&nivel(['relatorios'],'admin.bi.criar')===2,
   exportar:atual>0&&nivel(['relatorios'],'admin.bi.exportar')>0,
   proprios:id==='comercial'&&config?.crmEscopo!=='todos',
  }
 }
 return resultado
}
export async function autorizarRelatorio(req:NextRequest,u:UsuarioTenant,id:RelatorioId,edicao=false){
 try{
  const acesso=(await carregarPermissoesRelatorios(u))[id]
  const exportar=req.nextUrl.searchParams.get('finalidade')==='exportar'
  if(!acesso.consultar||(edicao&&!acesso.editar)||(exportar&&!acesso.exportar))
   return NextResponse.json({error:'Você não possui autorização para esta ação no relatório.'},{status:403,headers:{'Cache-Control':'no-store'}})
  return null
 }catch{return NextResponse.json({error:'Não foi possível conferir as permissões.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
