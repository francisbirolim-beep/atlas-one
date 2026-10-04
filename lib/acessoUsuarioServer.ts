import { supabaseAdmin } from './supabaseAdmin'

export type NivelAcessoServer = 'oculto' | 'consulta' | 'edicao'

const peso:Record<NivelAcessoServer,number> = {oculto:0,consulta:1,edicao:2}

function nivel(v:unknown):NivelAcessoServer {
  return v === 'edicao' ? 'edicao' : v === 'consulta' ? 'consulta' : 'oculto'
}

function menor(a:NivelAcessoServer,b:NivelAcessoServer):NivelAcessoServer {
  return peso[a] <= peso[b] ? a : b
}

async function lerConfig(usuarioId:string) {
  try {
    const {data}=await supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave',`acesso_usuario:${usuarioId}`).maybeSingle()
    if(!data?.valor) return null
    return typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
  } catch {
    return null
  }
}

export async function nivelAcaoUsuarioServer(params:{
  usuarioId:string
  role:string
  setorId:string
  acaoId:string
  empresaId?:string
}):Promise<NivelAcessoServer> {
  if(params.role==='master') return 'edicao'

  let q=supabaseAdmin.from('permissoes').select('nivel').eq('usuario_id',params.usuarioId).eq('setor_id',params.setorId)
  if(params.empresaId) q=q.eq('empresa_id',params.empresaId)
  const {data:permissao}=await q.maybeSingle()
  const nivelSetor=nivel(permissao?.nivel)
  if(nivelSetor==='oculto') return 'oculto'

  const config=await lerConfig(params.usuarioId)
  const explicito=nivel(config?.acoes?.[params.acaoId])
  if(!config?.acoes || !(params.acaoId in config.acoes)) return nivelSetor
  return menor(nivelSetor,explicito)
}

export async function usuarioPodeAcaoServer(params:{
  usuarioId:string
  role:string
  setorId:string
  acaoId:string
  minimo?:NivelAcessoServer
  empresaId?:string
}) {
  const atual=await nivelAcaoUsuarioServer(params)
  return peso[atual] >= peso[params.minimo||'consulta']
}