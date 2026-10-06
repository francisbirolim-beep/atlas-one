import { NextRequest, NextResponse } from 'next/server'
import { transcreverAudioGratis } from '@/lib/ai/transcricaoGratis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_AUDIO_BYTES = 20 * 1024 * 1024

function urlAssinadaValida(raw:string){
  try{
    const alvo=new URL(raw)
    const base=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'')
    if(alvo.origin!==base.origin)return false
    return alvo.pathname.includes('/storage/v1/object/sign/whatsapp-midia/')
  }catch{return false}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}))
    const audioUrl=String(body?.url||'').trim()
    const nome=String(body?.nome||'audio-whatsapp').slice(0,180)
    const mimeInformado=String(body?.mimeType||'').toLowerCase()
    if(!audioUrl||!urlAssinadaValida(audioUrl)){
      return NextResponse.json({error:'Fonte de áudio inválida.'},{status:400})
    }

    const origem=await fetch(audioUrl,{cache:'no-store'})
    if(!origem.ok)return NextResponse.json({error:'Não foi possível abrir o áudio temporário.'},{status:502})
    const blob=await origem.blob()
    const mime=(mimeInformado||blob.type||'audio/ogg').split(';')[0]
    if(!mime.startsWith('audio/'))return NextResponse.json({error:'Arquivo não é áudio.'},{status:400})
    if(!blob.size||blob.size>MAX_AUDIO_BYTES)return NextResponse.json({error:'Áudio vazio ou maior que 20 MB.'},{status:400})

    const resultado=await transcreverAudioGratis(new File([blob],nome,{type:mime}))
    return NextResponse.json({
      text:resultado.text,
      provider:resultado.provider,
      model:resultado.model,
      custoEstimado:0,
      paidFallbackUsed:false,
    })
  }catch(e:any){
    return NextResponse.json({
      error:e?.message||'Erro ao transcrever áudio do WhatsApp.',
      custoEstimado:0,
      paidFallbackUsed:false,
    },{status:503})
  }
}
