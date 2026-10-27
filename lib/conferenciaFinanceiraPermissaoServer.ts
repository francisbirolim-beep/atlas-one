import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { UsuarioTenant } from '@/lib/tenantServer'

/** Única regra de autorização, aplicada também dentro das funções SQL.
 *  A checagem utiliza o JWT do usuário, nunca a credencial de serviço. */
export async function permitidoConferirVenda(req:NextRequest,usuario:UsuarioTenant):Promise<boolean>{
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
 if(!token)return false
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:'Bearer '+token}}
 })
 const {data,error}=await db.rpc('fn_pode_conferir_financeiro_v1',{p_empresa:usuario.empresa_id})
 if(error)throw new Error('Não foi possível conferir as permissões financeiras.')
 return data===true
}
