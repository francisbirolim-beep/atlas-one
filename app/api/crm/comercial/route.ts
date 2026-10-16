import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lerAcessoConfigServer, usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Etapa = 'novo'|'qualificacao'|'visita'|'proposta'|'negociacao'|'ganho'|'perdido'
type EntradaCRM = {id:string;clienteId:string|null;nome:string;obra:string|null;cidade:string|null;canal:string|null;responsavel:string;etapa:Etapa;temperatura:'quente'|'morno'|'frio';valor:number|null;atualizadoEm:string|null;proximaAcao:string|null;proximaAcaoEm:string|null;link:string|null;fonte:string}
const text = (v: unknown):string|null => typeof v === 'string' && v.trim() ? v.trim() : null
const temperatura = (v: unknown): 'quente'|'morno'|'frio' => v === 'quente' || v === 'frio' ? v : 'morno'
function etapaOrc(v: unknown): Etapa {
  const s=String(v||'').toLowerCase()
  if(['convertido','vendido'].includes(s))return 'ganho'
  if(['recusado','perdido','cancelado'].includes(s))return 'perdido'
  if(['aprovado','negociacao'].includes(s))return 'negociacao'
  if(s==='enviado')return 'proposta'
  return 'qualificacao' // Rascunho nao e proposta enviada.
}
function etapaPros(v: unknown): Etapa {
  const s=String(v||'').toLowerCase()
  if(s==='convertido')return 'ganho'
  if(s==='sem_interesse')return 'perdido'
  if(s==='visita_agendada')return 'visita'
  if(s==='aguardando_retorno')return 'negociacao'
  if(['oportunidade_qualificada','aguardando_projeto'].includes(s))return 'qualificacao'
  return 'novo'
}
export async function GET(req: NextRequest) {
  try {
    const u=await autenticarTenant(req)
    if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
    const temCRM=await usuarioPodeAcaoServer({
      usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'crm',
      acaoId:'comercial.crm.consultar',minimo:'consulta',
    })
    if(!temCRM)return NextResponse.json({error:'Sem permissão para consultar o CRM.'},{status:403})
    const config=u.role==='master'?null:await lerAcessoConfigServer(u.id,u.empresa_id)
    const apenasProprios=u.role!=='master'&&config?.crmEscopo!=='todos'
    const valoresAutorizados=await usuarioPodeAcaoServer({
      usuarioId:u.id,role:u.role,empresaId:u.empresa_id,
      setorId:'fazer-orcamento-msanfyvj',acaoId:'comercial.orcamento.consultar',minimo:'consulta',
    })
    const limite=250
    let oq=supabaseAdmin.from('orcamentos')
      .select('id,cliente_id,cliente_nome,obra_nome,cidade,origem,criado_por_id,criado_por_nome,temperatura,status,valor_estimado,updated_at')
      .eq('empresa_id',u.empresa_id).or('revisao_atual.is.null,revisao_atual.eq.true')
      .or('eh_assistencia.is.null,eh_assistencia.eq.false')
      .order('updated_at',{ascending:false}).limit(limite)
    let pq=supabaseAdmin.from('prospeccoes')
      .select('id,nome_cliente,nome_obra,cidade,responsavel_id,responsavel_nome,temperatura,status,cliente_id,proxima_acao,proxima_acao_em,updated_at')
      .eq('empresa_id',u.empresa_id).order('updated_at',{ascending:false}).limit(limite)
    let tq=supabaseAdmin.from('crm_tarefas')
      .select('id,cliente_id,cliente_nome,titulo,data_vencimento,responsavel_id,responsavel_nome')
      .eq('empresa_id',u.empresa_id).eq('concluida',false)
      .order('data_vencimento',{ascending:true,nullsFirst:false}).limit(limite)
    if(apenasProprios) {
      oq=oq.eq('criado_por_id',u.id)
      pq=pq.eq('responsavel_id',u.id)
      tq=tq.eq('responsavel_id',u.id)
    }
    // Dados de leitura, somente da empresa autenticada; sem precificacao,
    // custos, financeiro, anexos, telefones ou conversas privadas.
    const [orcs,pros,tarefas]=await Promise.all([oq,pq,tq])
    if(orcs.error||pros.error||tarefas.error) {
      console.error('Consulta isolada do CRM indisponível')
      return NextResponse.json({error:'Falha ao carregar os dados comerciais.'},{status:503})
    }
    const oportunidades: EntradaCRM[]=(orcs.data||[]).map((o:any)=>({
      id:'orc:'+o.id,clienteId:text(o.cliente_id),nome:text(o.cliente_nome)||'Cliente sem nome',
      obra:text(o.obra_nome),cidade:text(o.cidade),canal:text(o.origem),
      responsavel:text(o.criado_por_nome)||'Não definido',etapa:etapaOrc(o.status),
      temperatura:temperatura(o.temperatura),valor:valoresAutorizados&&o.valor_estimado!==null?Number(o.valor_estimado):null,
      atualizadoEm:text(o.updated_at),proximaAcao:null,proximaAcaoEm:null,
      link:valoresAutorizados?'/orcamento/'+o.id:null,fonte:'Orçamento',
    }))
    const vinculados=new Set((orcs.data||[]).map((o:any)=>o.cliente_id).filter(Boolean))
    for(const p of pros.data||[]){
      if(p.status==='convertido'&&p.cliente_id&&vinculados.has(p.cliente_id))continue
      oportunidades.push({
        id:'pro:'+p.id,clienteId:text(p.cliente_id),nome:text(p.nome_cliente)||'Contato sem nome',
        obra:text(p.nome_obra),cidade:text(p.cidade),canal:'Prospecção',
        responsavel:text(p.responsavel_nome)||'Não definido',etapa:etapaPros(p.status),
        temperatura:temperatura(p.temperatura),valor:null,atualizadoEm:text(p.updated_at),
        proximaAcao:text(p.proxima_acao),proximaAcaoEm:text(p.proxima_acao_em),
        link:'/prospeccao/'+p.id,fonte:'Prospecção',
      })
    }
    oportunidades.sort((a,b)=>String(b.atualizadoEm||'').localeCompare(String(a.atualizadoEm||'')))
    const agenda=(tarefas.data||[]).map((t:any)=>({
      id:t.id,cliente:t.cliente_nome,titulo:t.titulo,
      vencimento:t.data_vencimento,responsavel:t.responsavel_nome||'Não definido',
    }))
    return NextResponse.json({
      ok:true,somenteLeitura:true,escopo:apenasProprios?'proprios':'todos',
      valorVisivel:valoresAutorizados,oportunidades,agenda,
      resultadoParcial:[orcs.data?.length,pros.data?.length,tarefas.data?.length].some(n=>(n||0)>=limite),
      limitePorFonte:limite,
    },{headers:{'Cache-Control':'private, no-store'}})
  }catch {
    return NextResponse.json({error:'Não foi possível confirmar as permissões do CRM.'},{status:503})
  }
}