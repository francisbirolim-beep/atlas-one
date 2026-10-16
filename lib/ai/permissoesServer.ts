import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lerAcessoConfigServer } from '@/lib/acessoUsuarioServer'
import type { UsuarioTenant } from '@/lib/tenantServer'
import { AI_ESPECIALISTAS } from './specialists'
import type { AIModulo } from './types'
import { restringirEscopoIA, type EscopoIA } from './acessoDominio'

export type AcessoDominioIA = { permitido: boolean; escopo: EscopoIA; origem: 'master'|'configurado'|'setor'|'negado'; motivo: string }
export type PermissoesIA = { geral: boolean; dominios: Record<AIModulo,AcessoDominioIA>; auxiliares: Record<string,boolean>; assinatura: string; edicoes: Record<string,boolean> }
const LEITURAS: Partial<Record<AIModulo,Array<[string,string]>>> = {
 gestao:[['direcao','admin.direcao.dashboard'],['consultoria','consultoria.indicadores'],['relatorios','admin.bi.consultar']],
 comercial:[['crm','comercial.crm.consultar']],
 orcamento:[['orcamentos','comercial.pedido_orcamento.consultar'],['fazer-orcamento-msanfyvj','comercial.orcamento.consultar']],
 engenharia:[['mee','engenharia.mee.consultar'],['engenharia','engenharia.geral.consultar'],['engenharia-projeto','engenharia.projeto.consultar'],['cadastro','admin.cadastros.consultar']],
 financeiro:[['financeiro','financeiro.ia.consultar']],
 compras:[['compras','compras.geral.consultar']],
 estoque:[['estoque','estoque.consultar'],['recebimento','compras.recebimento.consultar']],
 producao:[['producao','producao.geral.consultar']],
 instalacao:[['instalacao','producao.instalacao.consultar'],['pos-venda','clientes.pos_venda.consultar'],['assistencia-abrir','clientes.assistencia.consultar'],['assistencia-painel','clientes.assistencia.consultar']],
 medicao_final:[['medida-final-msdwtt9y','producao.medida_final.consultar'],['medicao','engenharia.medicao.consultar']],
 rh:[['rh','rh.colaboradores.consultar']],qualidade:[['qualidade','producao.qualidade.consultar']],pd:[['ped','engenharia.ped.consultar']],
}
const visivel=(v:unknown)=>v==='consulta'||v==='edicao'
export async function carregarPermissoesIA(usuario: UsuarioTenant): Promise<PermissoesIA> {
 if(!usuario.empresa_id)throw Error('Empresa não identificada.')
 const dominios={} as Record<AIModulo,AcessoDominioIA>
 if(usuario.role==='master'){
  for(const e of AI_ESPECIALISTAS)dominios[e.modulo]={permitido:true,escopo:'empresa',origem:'master',motivo:'Usuário Master.'}
  return {geral:true,dominios,auxiliares:{custos_precos:true,fornecedores:true},assinatura:'master',edicoes:Object.fromEntries([...AI_ESPECIALISTAS.map(e=>e.modulo),'catalogo_produto','catalogo_fornecedor'].map(id=>[id,true]))}
 }
 const [config,p,o]=await Promise.all([
  lerAcessoConfigServer(usuario.id,usuario.empresa_id),
  supabaseAdmin.from('permissoes').select('setor_id,nivel').eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id),
  supabaseAdmin.from('ia_acessos_dominio').select('dominio,escopo,permitido').eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id),
 ])
 if(p.error||o.error)throw Error('Não foi possível conferir as restrições da IA.')
 const acoes=config?.acoes||{}
 const setores=new Set((p.data||[]).filter(x=>visivel(x.nivel)).map(x=>String(x.setor_id)))
 const overrides=new Map((o.data||[]).map(x=>[String(x.dominio),x]))
 const geral=(!Object.hasOwn(acoes,'ia.geral')||visivel(acoes['ia.geral']))&&
  (!overrides.has('geral')||restringirEscopoIA('empresa',overrides.get('geral'))!=='nenhum')
 for(const e of AI_ESPECIALISTAS){
  const especifica='ia.'+e.modulo
  const leituras=LEITURAS[e.modulo]||e.setorIds.map(id=>[id,''] as [string,string])
  const permitido=geral&&leituras.some(([id,acao])=>setores.has(id)&&(!acao||!Object.hasOwn(acoes,acao)||visivel(acoes[acao])))&&
   (!Object.hasOwn(acoes,especifica)||visivel(acoes[especifica]))&&
   (e.modulo!=='financeiro'||['financeiro.geral.consultar','financeiro.contas_pagar.consultar','financeiro.contas_receber.consultar'].every(a=>!Object.hasOwn(acoes,a)||visivel(acoes[a])))

  const base:EscopoIA=(e.modulo==='comercial'||e.modulo==='orcamento')&&config?.crmEscopo!=='todos'?'proprio':'setor'
  const escopo=permitido?restringirEscopoIA(base,overrides.get(e.modulo)):'nenhum'
  dominios[e.modulo]={permitido:escopo!=='nenhum',escopo,origem:overrides.has(e.modulo)?'configurado':permitido?'setor':'negado',motivo:escopo==='nenhum'?'Acesso restringido pelas autorizações do usuário.':'Permissão limitada ao setor e ao escopo autorizado.'}
 }
 const auxiliares:Record<string,boolean>={}
 for(const d of ['custos_precos','fornecedores'])auxiliares[d]=geral&&restringirEscopoIA('empresa',overrides.get(d)||{permitido:false})!=='nenhum'
 // Invalida sessões quando qualquer fonte de autorização muda.
 const assinatura=createHash('sha256').update(JSON.stringify({
  empresa:usuario.empresa_id,usuario:usuario.id,config,
  permissoes:[...(p.data||[])].sort((a,b)=>String(a.setor_id).localeCompare(String(b.setor_id))),
  overrides:[...(o.data||[])].sort((a,b)=>String(a.dominio).localeCompare(String(b.dominio))),
 })).digest('hex')
 const edicoes:Record<string,boolean>={}
 const setoresEdicao=new Set((p.data||[]).filter(x=>x.nivel==='edicao').map(x=>String(x.setor_id)))
 for(const e of AI_ESPECIALISTAS)edicoes[e.modulo]=dominios[e.modulo].permitido&&dominios[e.modulo].escopo!=='proprio'&&
  (LEITURAS[e.modulo]||e.setorIds.map(id=>[id,''] as [string,string])).some(([id])=>setoresEdicao.has(id))
 for(const [id,acao] of [['catalogo_produto','admin.cadastros.produtos'],['catalogo_fornecedor','admin.cadastros.fornecedores']])
  edicoes[id]=setoresEdicao.has('cadastro')&&(!Object.hasOwn(acoes,acao)||acoes[acao]==='edicao')
 return {geral,dominios,auxiliares,assinatura,edicoes}
}

/** Clientes próprios por vínculo UUID; nomes de vendedor não provam titularidade. */
export async function idsClientesPropriosIA(usuario:UsuarioTenant) {
 const {data,error}=await supabaseAdmin.from('orcamentos').select('cliente_id')
  .eq('empresa_id',usuario.empresa_id).eq('criado_por_id',usuario.id).not('cliente_id','is',null).limit(1001)
 if(error)throw Error('Não foi possível conferir a carteira do usuário.')
 // Não amplia a consulta nem entrega um resultado silenciosamente incompleto.
 if((data||[]).length>=1000)throw Error('Carteira muito extensa para esta consulta. Refine a pesquisa.')
 return Array.from(new Set((data||[]).map(x=>String(x.cliente_id)).filter(Boolean)))
}
