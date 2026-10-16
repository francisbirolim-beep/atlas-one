import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {QUADROS} from '@/lib/centralKanban'
export const dynamic='force-dynamic'
/** Leitura isolada das três bibliotecas de coluna. Não chama GET da Central,
 * cujo semeador poderia criar colunas padrão e violar o compromisso da prévia. */
export async function GET(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return NextResponse.json({erro:'Sessão inválida'},{status:401})
 if(u.role!=='master')return NextResponse.json({erro:'Prévia de configuração reservada ao Master'},{status:403})
 try{
  const empresa=u.empresa_id
  const [central,comercial,setores]=await Promise.all([
   db.from('central_kanban_colunas').select('id,setor,nome,ordem').eq('empresa_id',empresa).order('ordem'),
   db.from('kanban_colunas').select('id,nome,ordem').eq('empresa_id',empresa).order('ordem'),
   db.from('setor_kanban_colunas').select('id,setor_id,nome,ordem').eq('empresa_id',empresa).order('ordem'),
  ])
  if(central.error||comercial.error||setores.error)throw central.error||comercial.error||setores.error
  const cols=[...(central.data||[]).map(c=>({...c,setor:'central:'+c.setor})),
   ...(comercial.data||[]).map(c=>({...c,setor:'orcamento:comercial'})),
   ...(setores.data||[]).map(c=>({id:c.id,nome:c.nome,ordem:c.ordem,setor:'setor:'+c.setor_id}))]
  const nomes=new Map(QUADROS.map(q=>[q.id,q.nome]))
  const keys=[...new Set(cols.map(c=>c.setor))]
  const quadros=keys.map(id=>{
   const [origem,setor]=id.split(':')
   const rotulo=nomes.get(setor as typeof QUADROS[number]['id'])||setor.replaceAll('-',' ')
   return{id,nome:(origem==='central'?'Central':origem==='orcamento'?'Orçamentos':'Setor')+' · '+rotulo}
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  return NextResponse.json({colunas:cols,quadros,permissoes:Object.fromEntries(keys.map(k=>[k,'administrar'])),
   aviso:'Consulta somente leitura; adicionar, renomear, excluir e mover são simulações locais.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[kanban preview]',e);return NextResponse.json({erro:'Não foi possível consultar a biblioteca de colunas'},{status:503})}
}
