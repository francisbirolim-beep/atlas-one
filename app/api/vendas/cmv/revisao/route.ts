import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPrevisaoWVetro } from '@/lib/wvetroCmvResumo'
import { CATEGORIAS_CMV_REVISAO, centavos, custoPrevistoOriginal, type CategoriaCmvRevisao } from '@/lib/vendaCmvRevisao'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const CHAVE_IA='atlas_operacional:v1:cmv_wvetro'
const CHAVE_VENDA='atlas_cmv_revisao:v1:'
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status})
const texto=(v:unknown,max=500)=>String(v??'').trim().slice(0,max)
const arredondado=(v:unknown):number|null=>{
 if(typeof v==='number')return Number.isFinite(v)?centavos(v):null
 let s=String(v??'').trim()
 if(!s)return null
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 if(!/^\d+(\.\d{1,2})?$/.test(s))return null
 const n=Number(s)
 return Number.isFinite(n)?centavos(n):null
}
export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{
  const b=await req.json()
  const vendaId=texto(b.vendaId,80)
  const categoria=texto(b.categoria,30) as CategoriaCmvRevisao
  const acao=texto(b.acao,30)
  const justificativa=texto(b.justificativa,500)
  if(!/^[0-9a-f-]{36}$/i.test(vendaId))return erro('Venda inválida.')
  if(!CATEGORIAS_CMV_REVISAO.includes(categoria))return erro('Categoria inválida.')
  if(!['validado','corrigido'].includes(acao))return erro('Ação inválida.')
  if(acao==='corrigido'&&justificativa.length<8)return erro('Descreva o motivo da correção (mínimo 8 caracteres).')
  const {data:venda,error:erroVenda}=await supabaseAdmin.from('vendas_obras')
   .select('id,orcamento_id').eq('id',vendaId).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(erroVenda)throw erroVenda
  if(!venda)return erro('Venda não localizada nesta empresa.',404)
  const {data:orc,error:erroOrc}=await supabaseAdmin.from('orcamentos')
   .select('wvetro_fluxo').eq('id',venda.orcamento_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(erroOrc)throw erroOrc
  if(!orc)return erro('Orçamento não encontrado.',404)
  const fluxo=(orc.wvetro_fluxo||{}) as Record<string,any>
  const numero=texto(fluxo.numero||fluxo.numero_wvetro,50)
  let extra:Record<string,unknown>={}
  if(numero){
   const {data,error}=await supabaseAdmin.from('wvetro_orcamentos_historico')
    .select('custo_sem_sobra,custo_com_sobra').eq('empresa_id',usuario.empresa_id).eq('wvetro_numero',numero).maybeSingle()
   if(error)throw error
   if(data)extra=data
  }
  const bruto=extrairPrevisaoWVetro({...extra,...fluxo})
  const valorOrigem=custoPrevistoOriginal(bruto,categoria)
  if(acao==='validado'&&valorOrigem===null)return erro('O W.Vetro ainda não informou esse custo. Use Corrigir para registrar o valor conferido.',422)
  const ajustado=acao==='validado'?valorOrigem:arredondado(b.valor)
  if(ajustado===null||ajustado<0||ajustado>999999999)return erro('Informe um custo válido em reais.')
  if(acao==='corrigido'&&ajustado===valorOrigem)return erro('O valor é igual ao W.Vetro. Use Validar custo.')
  const agora=new Date().toISOString()
  const auditoria={versao:1,venda_id:venda.id,orcamento_id:venda.orcamento_id,
   numero_wvetro:numero,categoria,acao,valor_origem:valorOrigem,valor_revisado:ajustado,
   justificativa:acao==='validado'?'Custo conferido pelo responsável.':justificativa,
   usuario_nome:usuario.nome,registrado_em:agora}
  const eventoIA={
   versao:1,dominio:'cmv_wvetro',tipo:acao==='validado'?'custo_validado':'custo_corrigido',
   entidade_tipo:'venda',entidade_id:venda.id,
   contexto:{categoria,fonte:'W.Vetro'},
   dados:{valor_wvetro:valorOrigem,valor_confirmado:ajustado,motivo:auditoria.justificativa},
   evidencia:usuario.role==='master'?'validado':'observado',registrado_em:agora
  }
  // Os dois registros são atômicos (mesmo INSERT): histórico por venda e
  // evidência consultável na memória operacional de IA. Não há treinamento automático.
  const {error}=await supabaseAdmin.from('agente_memorias').insert([
   {empresa_id:usuario.empresa_id,usuario_id:usuario.id,chave:CHAVE_VENDA+venda.id,valor:JSON.stringify(auditoria)},
   {empresa_id:usuario.empresa_id,usuario_id:usuario.id,chave:CHAVE_IA,valor:JSON.stringify(eventoIA)}
  ])
  if(error)throw error
  return NextResponse.json({ok:true,revisao:auditoria})
 }catch(e){
  console.error('Falha na revisão humana do CMV:',e)
  return erro('Não foi possível salvar a revisão de custos.',500)
 }
}
