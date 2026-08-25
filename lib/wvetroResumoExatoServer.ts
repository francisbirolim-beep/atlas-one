import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function contar(
  tabela: string,
  aplicar?: (q: any) => any,
) {
  let q: any = supabaseAdmin.from(tabela).select('id', { count: 'exact', head: true })
  if (aplicar) q = aplicar(q)
  const { count, error } = await q
  if (error) throw error
  return count || 0
}

/**
 * Resumo W.Vetro com contagens exatas no Postgres.
 *
 * Não usa data.length porque o PostgREST/Supabase limita respostas tabulares
 * a 1.000 linhas por padrão. Esse limite fazia a tela mostrar, por exemplo,
 * 386 perfis + 614 acessórios e 1.000 snapshots mesmo existindo 2.481 produtos.
 */
export async function resumoAuditoriaWVetroExato() {
  const [
    perfisWvetro,
    acessoriosWvetro,
    produtosComFoto,
    linhas,
    tipologias,
    tipologiasMapeadas,
    perfisHistoricos,
    acessoriosHistoricos,
    vidros,
    vidrosComImagem,
    snapshots,
    imagensCopiadas,
    comLinha,
    erros,
  ] = await Promise.all([
    contar('produtos', q => q.eq('origem', 'wvetro').eq('categoria', 'perfil')),
    contar('produtos', q => q.eq('origem', 'wvetro').eq('categoria', 'acessorio')),
    contar('produtos', q => q.eq('origem', 'wvetro').not('foto_url', 'is', null)),
    contar('wvetro_referencias_linhas'),
    contar('wvetro_referencias_tipologias'),
    contar('wvetro_referencias_tipologias', q => q.eq('status_mapeamento', 'mapeada_exata')),
    contar('wvetro_referencias_componentes', q => q.eq('tipo', 'perfil')),
    contar('wvetro_referencias_componentes', q => q.eq('tipo', 'acessorio')),
    contar('wvetro_referencias_vidros'),
    contar('wvetro_referencias_vidros', q => q.not('imagem_url', 'is', null)),
    contar('wvetro_produtos_snapshot'),
    contar('wvetro_produtos_snapshot', q => q.eq('imagem_status', 'copiada')),
    contar('wvetro_produtos_snapshot', q => q.not('linha_nome_wvetro', 'is', null)),
    contar('wvetro_produtos_snapshot', q => q.not('erro', 'is', null)),
  ])

  return {
    catalogoAtlas: {
      perfisWvetro,
      acessoriosWvetro,
      produtosComFoto,
    },
    referencias: {
      linhas,
      tipologias,
      tipologiasMapeadas,
      perfisHistoricos,
      acessoriosHistoricos,
      vidros,
      vidrosComImagem,
    },
    apiProdutos: {
      snapshots,
      // Na tela, "comImagem" passa a significar imagem efetivamente copiada
      // para o Atlas, e não apenas URL informada pela origem.
      comImagem: imagensCopiadas,
      comLinha,
      erros,
    },
  }
}
