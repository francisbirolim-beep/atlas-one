import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const erro=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return erro('Sessão inválida.',401)
 const permitido=await usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,setorId:'financeiro',acaoId:'financeiro.contas_receber.recibo',minimo:'consulta'})
 if(!permitido)return erro('Sem permissão para gerar recibos.',403)
 const id=req.nextUrl.searchParams.get('id')||''
 if(!uuid.test(id))return erro('Recebimento inválido.')
 try{
  const {data:rec,error}=await supabaseAdmin.from('financeiro_recebimentos').select('id,cliente_id,cliente_nome,obra_id,data_recebimento,valor,forma,referencia,observacoes,status').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(error)throw error
  if(!rec||rec.status==='cancelado')return erro('Recebimento não encontrado ou cancelado.',404)
  const {data:alocacoes,error:eAloc}=await supabaseAdmin.from('financeiro_recebimento_alocacoes').select('obra_id').eq('recebimento_id',id)
  if(eAloc)throw eAloc
  const obraIds=Array.from(new Set([rec.obra_id,...(alocacoes||[]).map(a=>a.obra_id)].filter(Boolean))) as string[]
  const obraUnica=obraIds.length===1?obraIds[0]:null
  const {data:obras,error:eObras}=obraIds.length?await supabaseAdmin.from('obras').select('id,nome').eq('empresa_id',u.empresa_id).eq('cliente_id',rec.cliente_id).in('id',obraIds):{data:[],error:null}
  if(eObras)throw eObras
  const nomes=(obras||[]).map(o=>o.nome)
  let q=supabaseAdmin.from('financeiro_contas_receber').select('id,valor,valor_pago,valor_desconto,status').eq('empresa_id',u.empresa_id).eq('cliente_id',rec.cliente_id).neq('status','cancelado').limit(2001)
  if(obraUnica)q=q.eq('obra_id',obraUnica)
  const {data:contas,error:eContas}=await q
  if(eContas)throw eContas
  if((contas||[]).length>2000)return erro('Muitos títulos para calcular saldo completo; use o extrato do cliente.',422)
  const saldo=(contas||[]).reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  return NextResponse.json({ok:true,recibo:{...rec,obras:nomes,saldoAtual:Number(saldo.toFixed(2)),escopo:obraUnica?'obra':'cliente',geradoEm:new Date().toISOString()}})
 }catch(e){console.error('Recibo financeiro:',e);return erro('Não foi possível calcular o recibo.',500)}
}
