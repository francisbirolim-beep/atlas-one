import { NextRequest, NextResponse } from 'next/server'
import { contextoCliente360Server } from '@/lib/cliente360AcessoServer'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarMatrizCliente360, nivelValido360 } from '@/lib/cliente360Permissoes'
export async function PUT(req: NextRequest) {
  try {
    const usuario=await autenticarTenant(req)
    if(!usuario)return NextResponse.json({error:'Não autenticado'},{status:401})
    if(usuario.role!=='master')return NextResponse.json({error:'Somente o Master pode alterar autorizações.'},{status:403})
    const body=await req.json()
    const {data:alvo,error:alvoErro}=await supabaseAdmin.from('usuarios').select('id,role').eq('id',String(body.usuarioId||'')).eq('empresa_id',usuario.empresa_id).maybeSingle()
    if(alvoErro||!alvo)return NextResponse.json({error:'Usuário não encontrado nesta empresa.'},{status:404})
    if(alvo.role==='master')return NextResponse.json({error:'Master mantém acesso completo.'},{status:400})
    const bruto=body.config
    if(!bruto||typeof bruto!=='object'||Array.isArray(bruto))return NextResponse.json({error:'Configuração inválida.'},{status:400})
    const config={crmEscopo:bruto.crmEscopo==='todos'?'todos':'proprios',cliente360:normalizarMatrizCliente360(bruto.cliente360),modulos:Object.fromEntries(Object.entries(bruto.modulos||{}).filter(([,v])=>nivelValido360(v))),acoes:Object.fromEntries(Object.entries(bruto.acoes||{}).filter(([,v])=>nivelValido360(v)))}
    const {error}=await supabaseAdmin.rpc('salvar_acesso_usuario_etapas_backend',{p_usuario_id:alvo.id,p_empresa_id:usuario.empresa_id,p_config:config})
    if(error)throw error
    return NextResponse.json({ok:true})
  }catch{return NextResponse.json({error:'Não foi possível salvar as autorizações.'},{status:500})}
}

export async function GET(req:NextRequest) {
  try {
    const usuario=await autenticarTenant(req)
    if(!usuario)return NextResponse.json({error:'Não autenticado.'},{status:401})
    return NextResponse.json(await contextoCliente360Server(usuario),{headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({error:'Não foi possível conferir os acessos.'},{status:503})}
}
