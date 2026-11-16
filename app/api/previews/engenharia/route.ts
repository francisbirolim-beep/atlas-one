import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Prévia: leitura exclusiva de variáveis e referências técnicas reais do Atlas/W.Vetro.
// Não oferece POST/PUT/DELETE e não executa nem altera fórmulas.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const usuario=await autenticarBalcao(req,'venda-balcao','consulta')
  if(!usuario||usuario.role!=='master')
    return NextResponse.json({error:'Prévia disponível somente para o perfil Master.'},{status:403})

  const tipo=req.nextUrl.searchParams.get('tipo')||'variaveis'
  try {
    if(tipo==='tipologias'){
      // Busca somente os cadastros reais. A foto é da própria tipologia,
      // e os vínculos de linha são lidos diretamente de linha_tipologias.
      const [ts,ls,vs]=await Promise.all([
        supabaseAdmin.from('tipologias')
          .select('id,chave,label,categoria,ordem,foto_url,ativo')
          .eq('ativo',true).order('ordem',{ascending:true}).limit(500),
        supabaseAdmin.from('linhas_tecnicas')
          .select('id,chave,nome,ordem,apelidos,ativo')
          .eq('ativo',true).order('ordem',{ascending:true}).limit(500),
        supabaseAdmin.from('linha_tipologias')
          .select('tipologia_id,linha_id').limit(5000)
      ])
      if(ts.error||ls.error||vs.error)throw ts.error||ls.error||vs.error
      const links=vs.data||[]
      const tipologias=(ts.data||[]).map(t=>({
        ...t,
        linhaIds:links.filter(v=>v.tipologia_id===t.id).map(v=>v.linha_id)
      }))
      const linhas=(ls.data||[]).map(l=>({
        ...l,
        tipologia_ids:links.filter(v=>v.linha_id===l.id).map(v=>v.tipologia_id)
      }))
      return NextResponse.json({tipologias,linhas,somenteLeitura:true},
        {headers:{'Cache-Control':'no-store'}})
    }
    if(tipo==='variaveis'){
      const tipologiaId=req.nextUrl.searchParams.get('tipologiaId')||''
      if(tipologiaId&&!uuid.test(tipologiaId))
        return NextResponse.json({error:'Tipologia inválida.'},{status:400})
      const [vs,os,ts]=await Promise.all([
        supabaseAdmin.from('engenharia_variaveis').select('id,chave,label,ordem').order('ordem',{ascending:true}).limit(150),
        supabaseAdmin.from('engenharia_variavel_opcoes').select('id,variavel_id,chave,label,ordem').order('ordem',{ascending:true}).limit(500),
        tipologiaId
          ?supabaseAdmin.from('engenharia_tipologia_variaveis').select('variavel_id,tipologia_id,ordem,obrigatorio').eq('tipologia_id',tipologiaId).order('ordem',{ascending:true}).limit(150)
          :Promise.resolve({data:[],error:null}),
      ])
      if(vs.error||os.error||ts.error) throw vs.error||os.error||ts.error
      return NextResponse.json({
        variaveis:(vs.data||[]).map(v=>({
          id:v.id,chave:v.chave,label:v.label,ordem:v.ordem,
          opcoes:(os.data||[]).filter(o=>o.variavel_id===v.id).map(o=>({id:o.id,chave:o.chave,label:o.label,ordem:o.ordem}))
        })),
        vinculadas:(ts.data||[]).map(x=>({variavelId:x.variavel_id,obrigatorio:x.obrigatorio,ordem:x.ordem})),
        somenteLeitura:true,
      },{headers:{'Cache-Control':'no-store'}})
    }
    if(tipo==='vidros'){
      const {data,error}=await supabaseAdmin.from('wvetro_referencias_vidros')
        .select('id,codigo,especificacao,produto_atlas_id,status_validacao,ocorrencias')
        .order('especificacao',{ascending:true}).limit(150)
      if(error)throw error
      return NextResponse.json({
        vidros:(data||[]).filter(v=>!!v.especificacao).map(v=>({
          id:v.id,codigo:v.codigo,descricao:v.especificacao,produtoAtlasId:v.produto_atlas_id,
          status:v.status_validacao,
          referenciaNaoPrecificada:!v.produto_atlas_id
        })),
        somenteLeitura:true,
      },{headers:{'Cache-Control':'no-store'}})
    }
    return NextResponse.json({error:'Consulta inválida.'},{status:400})
  } catch(e) {
    console.error('Erro ao ler referências para prévia de engenharia:',e)
    return NextResponse.json({error:'Não foi possível carregar o catálogo técnico.'},{status:500})
  }
}
