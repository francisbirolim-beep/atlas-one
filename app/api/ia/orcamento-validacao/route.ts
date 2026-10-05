import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function snapshotOrcamento(o:any){
  return {
    cliente_nome:o?.cliente_nome||null,
    cliente_whatsapp:o?.cliente_whatsapp||null,
    cidade:o?.cidade||null,
    acabamento:o?.acabamento||null,
    contramarco:o?.contramarco||null,
    tipo_medida:o?.tipo_medida||null,
    tipo_esquadria:o?.tipo_esquadria||null,
    largura_mm:o?.largura_mm??null,
    altura_mm:o?.altura_mm??null,
    quantidade:o?.quantidade??null,
    itens:Array.isArray(o?.itens)?o.itens:[],
  }
}

function snapshotOriginal(v:any){
  return {
    cliente_nome:v?.cliente_nome||null,
    cliente_whatsapp:v?.cliente_whatsapp||null,
    cidade:v?.cidade||null,
    acabamento:v?.acabamento||null,
    contramarco:v?.contramarco||null,
    tipo_medida:v?.tipo_medida||null,
    tipo_esquadria:v?.itens?.[0]?.tipo_esquadria||null,
    largura_mm:v?.itens?.[0]?.largura_mm??null,
    altura_mm:v?.itens?.[0]?.altura_mm??null,
    quantidade:v?.itens?.[0]?.quantidade??null,
    itens:Array.isArray(v?.itens)?v.itens:[],
  }
}

function diferencas(original:any, final:any){
  const out:Record<string,{antes:any;depois:any}>={}
  for(const chave of Object.keys(final)){
    if(JSON.stringify(original?.[chave]??null)!==JSON.stringify(final?.[chave]??null)){
      out[chave]={antes:original?.[chave]??null,depois:final?.[chave]??null}
    }
  }
  return out
}

export async function POST(req:NextRequest){
  try{
    const usuario=await autenticarTenant(req)
    if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const body=await req.json().catch(()=>({}))
    const orcamentoId=String(body?.orcamentoId||'').trim()
    const acao=String(body?.acao||'').trim()
    if(!orcamentoId)return NextResponse.json({error:'Orçamento não informado.'},{status:400})
    if(!['validar','corrigir'].includes(acao))return NextResponse.json({error:'Ação inválida.'},{status:400})

    const {data:orcamento,error}=await supabaseAdmin.from('orcamentos')
      .select('*').eq('empresa_id',usuario.empresa_id).eq('id',orcamentoId).maybeSingle()
    if(error)throw error
    if(!orcamento)return NextResponse.json({error:'Orçamento não encontrado.'},{status:404})
    if(!orcamento.ia_criado)return NextResponse.json({error:'Este orçamento não foi criado pela IA.'},{status:409})

    const final=snapshotOrcamento(orcamento)
    const original=snapshotOriginal(orcamento.ia_resultado_original||{})
    const diffs=diferencas(original,final)
    if(acao==='corrigir'&&Object.keys(diffs).length===0){
      return NextResponse.json({error:'Faça ao menos uma correção antes de ensinar a IA.'},{status:400})
    }

    const status=acao==='corrigir'?'corrigido':'validado'
    const agora=new Date().toISOString()
    const {error:updateError}=await supabaseAdmin.from('orcamentos').update({
      ia_validacao_status:status,
      ia_validado_por_id:usuario.id,
      ia_validado_por_nome:usuario.nome||null,
      ia_validado_em:agora,
      ia_correcao:acao==='corrigir'?diffs:null,
      updated_at:agora,
    }).eq('empresa_id',usuario.empresa_id).eq('id',orcamentoId)
    if(updateError)throw updateError

    const {data:intake}=await supabaseAdmin.from('atendimento_whatsapp_intakes')
      .select('id').eq('empresa_id',usuario.empresa_id).eq('orcamento_id',orcamentoId)
      .order('created_at',{ascending:false}).limit(1).maybeSingle()

    const {error:feedbackError}=await supabaseAdmin.from('ai_orcamento_feedback').insert({
      empresa_id:usuario.empresa_id,
      orcamento_id:orcamentoId,
      intake_id:intake?.id||null,
      avaliacao:status,
      resultado_original:original,
      resultado_final:final,
      diferencas:acao==='corrigir'?diffs:{},
      usuario_id:usuario.id,
      usuario_nome:usuario.nome||null,
    })
    if(feedbackError)throw feedbackError

    return NextResponse.json({
      ok:true,
      status,
      diferencas:diffs,
      mensagem:acao==='corrigir'
        ?'Correção registrada. O Atlas usará este exemplo nas próximas leituras de orçamento.'
        :'Orçamento conferido e validado.',
    })
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Erro ao validar orçamento da IA.'},{status:500})
  }
}
