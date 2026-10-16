import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { autenticarTenant } from '@/lib/tenantServer'
import { contextoCliente360Server } from '@/lib/cliente360AcessoServer'
import { CLIENTE_360_RECURSOS, podeCliente360, type RecursoCliente360 } from '@/lib/cliente360Permissoes'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest,{params}:{params:{id:string}}) {
  try {
    const usuario=await autenticarTenant(req)
    if(!usuario)return NextResponse.json({error:'Não autenticado.'},{status:401})
    const acesso=await contextoCliente360Server(usuario)
    const pode=(recurso:RecursoCliente360)=>podeCliente360(acesso,recurso)
    if(!CLIENTE_360_RECURSOS.some(([id])=>pode(id)))return NextResponse.json({error:'Cliente 360 não liberado.'},{status:403})
    const token=req.headers.get('authorization')||''
    // As consultas com acesso direto mantêm o token do usuário e as políticas RLS.
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}})
    const clienteId=params.id
    const [c,os,orc,wvh,wvf,wvo,ass,med,int,cr,rec,docs]=await Promise.all([
      supabase.from('clientes').select(pode('cadastro') ? '*' : 'id,nome,telefone,whatsapp,email,cidade,endereco,created_at').eq('id',clienteId).maybeSingle(),
      pode('obras') ? supabase.from('obras').select('*').eq('cliente_id',clienteId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
      pode('orcamentos') ? supabase.from('orcamentos').select('id,numero,created_at,updated_at,valor_estimado,status,obra_id,revisao_versao,revisao_atual,revisao_tipo,revisao_motivo,origem,modo_entrada,descricao_livre,itens,wvetro_fluxo').eq('cliente_id',clienteId).or('modo_entrada.is.null,modo_entrada.neq.balcao').order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
      pode('orcamentos') ? supabase.from('wvetro_historico_comercial').select('id,tipo_registro,chave_externa,numero_wvetro,situacao_wvetro,data_emissao,data_venda,valor_total,metodo_identidade,status_vinculo,cliente_nome_origem,itens').eq('cliente_id',clienteId).eq('status_vinculo','seguro').eq('somente_historico',true).order('data_venda',{ascending:false,nullsFirst:false}).order('data_emissao',{ascending:false,nullsFirst:false}) : Promise.resolve({data:[],error:null}),
      pode('financeiro') ? supabase.from('wvetro_historico_financeiro').select('id,titulo_id_wvetro,fonte_wvetro,tipo_titulo,origem_titulo,documento,orcamento_wvetro,data_emissao,data_vencimento,data_baixa,valor_titulo,valor_recebido,valor_saldo,centro_custo_descricao,status_vinculo').eq('cliente_id',clienteId).eq('status_vinculo','seguro').eq('somente_historico',true).order('data_vencimento',{ascending:false,nullsFirst:false}) : Promise.resolve({data:[],error:null}),
      pode('historico') ? supabase.from('wvetro_historico_operacional').select('id,tipo_registro,chave_externa,numero_wvetro,data_programacao,data_inicio,data_termino,equipe_nome,observacao,quantidade_prevista,quantidade_realizada,orcamentos_wvetro,status_vinculo').eq('cliente_id',clienteId).eq('status_vinculo','seguro').eq('somente_historico',true).order('data_programacao',{ascending:false,nullsFirst:false}) : Promise.resolve({data:[],error:null}),
      pode('assistencias') ? supabase.from('assistencias').select('id,numero,created_at,descricao_problema,status,obra_id').eq('cliente_id',clienteId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
      pode('medicoes') ? supabase.from('medicoes_finais').select('id,created_at,status_operacional,obra_id,orcamento_id,tipo_medicao').eq('cliente_id',clienteId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
      pode('historico') ? supabase.from('crm_interacoes').select('id,created_at,tipo,descricao,usuario_nome').eq('cliente_id',clienteId).order('created_at',{ascending:false}).limit(100) : Promise.resolve({data:[],error:null}),
      pode('financeiro') ? supabase.from('financeiro_contas_receber').select('*').eq('cliente_id',clienteId).order('vencimento',{ascending:true}) : Promise.resolve({data:[],error:null}),
      pode('financeiro') ? supabase.from('financeiro_recebimentos').select('*').eq('cliente_id',clienteId).order('data_recebimento',{ascending:false}).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
      pode('documentos') ? supabase.from('cliente_documentos').select('*').eq('cliente_id',clienteId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
    ])
    if(c.error||!c.data)return NextResponse.json({error:'Cliente não encontrado ou acesso não liberado.'},{status:404})
    const outras=[os,orc,wvh,wvf,wvo,ass,med,int,cr,rec,docs]
    if(outras.some(r=>r.error))throw new Error('Falha ao carregar dados autorizados.')
    // Compras legadas são exclusivamente de servidor (authenticated não tem SELECT).
    // Reutilizar a autorização oficial de Compras, após validar o cliente pela RLS.
    // Quem acompanha apenas pedidos próprios usa o endpoint de solicitações por cliente.
    const comprasAcesso=pode('compras') ? await obterComprasAcessos(usuario) : null
    const comp=comprasAcesso?.consultar
      ? await supabaseAdmin.from('compras_necessidades')
        .select('id,created_at,descricao,categoria,quantidade,unidade,status,prioridade,obra_id,obra_nome')
        .eq('empresa_id',usuario.empresa_id).eq('cliente_id',clienteId)
        .order('created_at',{ascending:false})
      : {data:[],error:null}
    if(comp.error)throw comp.error
    const cliente=c.data as unknown as Record<string,unknown>
    if(!pode('observacoes'))delete cliente.observacoes
    const ids=(rec.data||[]).map((r:{id:string})=>r.id)
    const alo=ids.length ? await supabase.from('financeiro_recebimento_alocacoes').select('*').in('recebimento_id',ids).order('created_at',{ascending:true}) : {data:[],error:null}
    if(alo.error)throw alo.error
    return NextResponse.json({acesso,cliente,obras:os.data||[],orcamentos:orc.data||[],wvetroHistorico:wvh.data||[],wvetroFinanceiro:wvf.data||[],wvetroOperacional:wvo.data||[],assistencias:ass.data||[],medicoes:med.data||[],compras:comp.data||[],interacoes:int.data||[],contas:cr.data||[],recebimentos:rec.data||[],documentos:docs.data||[],alocacoes:alo.data||[]},{headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({error:'Não foi possível carregar o painel e conferir as autorizações. Tente novamente.'},{status:503})}
}
