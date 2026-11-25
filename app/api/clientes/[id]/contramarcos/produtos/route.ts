import { NextRequest,NextResponse } from 'next/server'
import { acessoComercialCM } from '@/lib/contramarcoComercialServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fotoCM,codigoCM } from '@/lib/contramarcoComercial'
export const runtime='nodejs'
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params,a=await acessoComercialCM(req,id)
  if(!a||!a.permissoes.verOrcamento)return NextResponse.json({error:'Sem acesso.'},{status:403})
  const categoria=req.nextUrl.searchParams.get('categoria'),codigo=req.nextUrl.searchParams.get('codigo'),busca=(req.nextUrl.searchParams.get('busca')||'').trim()
  if(!['perfil','acessorio'].includes(categoria||'')||busca.length>100)return NextResponse.json({error:'Busca inválida.'},{status:400})
  const q=supabaseAdmin.from('produtos').select('id,codigo,nome,categoria,foto_url').eq('empresa_id',a.usuario.empresa_id).eq('ativo',true).eq('categoria',categoria).not('foto_url','is',null)
  if(categoria==='perfil'){
    if(codigo!=='CM200'&&codigo!=='CM060')return NextResponse.json({error:'Código inválido.'},{status:400})
    q.ilike('codigo','%'+codigo.slice(2)+'%')
  }else{
    if(busca.length<2)return NextResponse.json({produtos:[]})
    q.ilike('nome','%'+busca.replace(/[%_]/g,'')+'%')
  }
  const {data,error}=await q.order('nome').limit(80)
  if(error)return NextResponse.json({error:'Catálogo indisponível.'},{status:503})
  return NextResponse.json({produtos:(data||[]).filter(p=>fotoCM(p.foto_url)&&(categoria!=='perfil'||codigoCM(p.codigo)===codigo))},{headers:{'Cache-Control':'private, no-store'}})
}
