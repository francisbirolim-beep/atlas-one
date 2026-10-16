import {carregarPermissoesIA} from '@/lib/ai/permissoesServer'
import { NextRequest, NextResponse } from 'next/server'
import { criarConversaAgente, validarConversaAgente, verificarUsuario } from '@/lib/agente'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function tituloConversa(texto: string) {
  const limpo = String(texto || '')
    .replace(/\[Anexo:[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpo) return 'Conversa com anexo'
  return limpo.length > 52 ? limpo.slice(0, 52).trimEnd() + '…' : limpo
}

export async function GET(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    if(!(await carregarPermissoesIA(usuario)).geral)return NextResponse.json({error:'Sem acesso à IA.'},{status:403})

    const conversaId = String(req.nextUrl.searchParams.get('id') || '').trim()
    if(usuario.role!=='master'){
      const acesso=await carregarPermissoesIA(usuario)
      if(conversaId&&!await validarConversaAgente(conversaId,usuario.id,usuario.empresa_id))
        return NextResponse.json({error:'Conversa não encontrada para este usuário.'},{status:404})
      let q=supabaseAdmin.from('ai_interacoes').select('id,pergunta,resposta,created_at,contexto_json')
        .eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id).eq('contexto','atlas_ia_geral')
        .contains('contexto_json',{permissoes_assinatura:acesso.assinatura})
      if(conversaId)q=q.contains('contexto_json',{conversa_id:conversaId})
      const {data,error}=await q.order('created_at',{ascending:false}).limit(conversaId?200:400)
      if(error)throw error
      const historico=[...(data||[])].reverse()
      if(conversaId)return NextResponse.json({conversaId,mensagens:historico.flatMap(i=>[
        {id:i.id+'-user',papel:'user',conteudo:i.pergunta,created_at:i.created_at},
        {id:i.id+'-assistant',papel:'assistant',conteudo:i.resposta,created_at:i.created_at},
      ])},{headers:{'Cache-Control':'no-store'}})
      const grupos=new Map<string,any>()
      for(const i of historico){
        const id=String(i.contexto_json?.conversa_id||'')
        if(!id)continue
        const anterior=grupos.get(id)
        grupos.set(id,{id,titulo:anterior?.titulo||tituloConversa(i.pergunta),preview:String(i.resposta||'').slice(0,90),createdAt:anterior?.createdAt||i.created_at,updatedAt:i.created_at,mensagens:(anterior?.mensagens||0)+2})
      }
      return NextResponse.json({conversas:Array.from(grupos.values()).reverse().slice(0,40)},{headers:{'Cache-Control':'no-store'}})
    }

    if (conversaId) {
      const validada = await validarConversaAgente(conversaId, usuario.id, usuario.empresa_id)
      if (!validada) return NextResponse.json({ error: 'Conversa não encontrada para este usuário.' }, { status: 404 })

      const { data: mensagens, error } = await supabaseAdmin
        .from('agente_mensagens')
        .select('id,papel,conteudo,created_at')
        .eq('conversa_id', validada)
        .eq('empresa_id', usuario.empresa_id)
        .order('created_at', { ascending: true })
        .limit(400)
      if (error) throw error

      return NextResponse.json({ conversaId: validada, mensagens: mensagens || [] })
    }

    const { data: conversas, error } = await supabaseAdmin
      .from('agente_conversas')
      .select('id,created_at')
      .eq('usuario_id', usuario.id)
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) throw error
    if (!conversas?.length) return NextResponse.json({ conversas: [] })

    const ids = conversas.map((c: any) => String(c.id))
    const { data: mensagens, error: mensagensError } = await supabaseAdmin
      .from('agente_mensagens')
      .select('conversa_id,papel,conteudo,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .in('conversa_id', ids)
      .order('created_at', { ascending: true })
      .limit(4000)
    if (mensagensError) throw mensagensError

    const porConversa = new Map<string, any[]>()
    for (const m of mensagens || []) {
      const id = String((m as any).conversa_id)
      const atual = porConversa.get(id) || []
      atual.push(m)
      porConversa.set(id, atual)
    }

    const lista = conversas
      .map((c: any) => {
        const itens = porConversa.get(String(c.id)) || []
        const primeira = itens.find((m: any) => m.papel === 'user')
        const ultima = itens[itens.length - 1]
        return {
          id: String(c.id),
          titulo: tituloConversa(String(primeira?.conteudo || 'Nova conversa')),
          preview: String(ultima?.conteudo || '').replace(/\s+/g, ' ').trim().slice(0, 90),
          createdAt: c.created_at,
          updatedAt: ultima?.created_at || c.created_at,
          mensagens: itens.length,
        }
      })
      .filter((c: any) => c.mensagens > 0)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json({ conversas: lista })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Nao foi possivel carregar as conversas: ' + String(e?.message || e) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await verificarUsuario(req.headers.get('authorization') || '')
    if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    if(!(await carregarPermissoesIA(usuario)).geral)return NextResponse.json({error:'Sem acesso à IA.'},{status:403})

    const conversaId = await criarConversaAgente(usuario.id, usuario.empresa_id)
    return NextResponse.json({ conversaId }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Nao foi possivel iniciar uma nova conversa: ' + String(e?.message || e) },
      { status: 500 },
    )
  }
}
