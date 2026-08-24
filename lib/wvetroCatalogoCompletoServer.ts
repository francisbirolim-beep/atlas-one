import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listarProdutosWVetroPorTipo, type WVetroProdutoTipo } from '@/lib/wvetroApi'

function txt(v: unknown) { return String(v ?? '').trim() }
function norm(v: unknown) { return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLocaleUpperCase('pt-BR') }
function foto(o: Record<string, unknown>) {
  for (const v of [o.URL, o.Url, o.url, o.Imagem, o.ImagemUrl, o.Foto, o.FotoUrl]) {
    const s = txt(v)
    if (/^https?:\/\//i.test(s)) return s
  }
  return null
}
function objetos(payload: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(payload)) { payload.forEach(v => objetos(v, out)); return out }
  if (!payload || typeof payload !== 'object') return out
  const o = payload as Record<string, unknown>
  if (o.ProdutoCodigo !== undefined || o.ProdutoSeuCodigo !== undefined || o.ProdutoDescricao !== undefined) out.push(o)
  Object.values(o).forEach(v => objetos(v, out))
  return out
}

export async function descobrirEImportarCatalogoWVetro(tipo: 'P' | 'A') {
  try {
    const payload = await listarProdutosWVetroPorTipo<unknown>(tipo)
    const encontrados = objetos(payload)
    const unicos = new Map<string, Record<string, unknown>>()
    for (const o of encontrados) {
      const codigo = txt(o.ProdutoCodigo ?? o.ProdutoSeuCodigo)
      if (codigo) unicos.set(norm(codigo), o)
    }
    if (unicos.size <= 1) {
      return { suportado: false, quantidadeApi: unicos.size, existentes: 0, importados: 0, ambiguos: 0 }
    }

    const categoria = tipo === 'P' ? 'perfil' : 'acessorio'
    const { data: produtos, error } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,codigo_origem,id_externo_wvetro')
      .eq('categoria', categoria)
    if (error) throw error

    const indice = new Map<string, any[]>()
    for (const p of produtos || []) {
      for (const codigo of [p.codigo, p.codigo_origem, p.id_externo_wvetro].map(norm).filter(Boolean)) {
        const lista = indice.get(codigo) || []
        lista.push(p)
        indice.set(codigo, lista)
      }
    }

    let existentes = 0, importados = 0, ambiguos = 0
    const snapshots: any[] = []

    for (const [codigoNorm, o] of unicos) {
      const codigo = txt(o.ProdutoCodigo ?? o.ProdutoSeuCodigo)
      const candidatos = indice.get(codigoNorm) || []
      let produtoId: string | null = null
      if (candidatos.length === 1) {
        existentes += 1
        produtoId = candidatos[0].id
      } else if (candidatos.length > 1) {
        ambiguos += 1
      } else {
        const descricao = txt(o.ProdutoDescricao) || codigo
        const unidadeOrigem = txt(o.Unidade) || null
        const ncmOrigem = txt(o.ProdutoNCM) || null
        const { data: novo, error: erroInsert } = await supabaseAdmin
          .from('produtos')
          .insert({
            nome: codigo && descricao ? `${codigo} - ${descricao}` : (descricao || codigo),
            categoria,
            preco: 0,
            unidade: null,
            descricao,
            foto_url: foto(o),
            ativo: o.ProdutoAtivo === undefined ? true : Boolean(o.ProdutoAtivo),
            codigo,
            codigo_origem: codigo,
            origem: 'wvetro',
            unidade_origem: unidadeOrigem,
            ncm_origem: ncmOrigem,
            ncm_status: ncmOrigem ? 'pendente' : null,
            status_validacao: 'importado',
            dados_origem: {
              fonte: 'API W.Vetro /Produtos/produtoByKey por tipo',
              codigo_raw: codigo,
              descricao_raw: descricao,
              unidade_raw: unidadeOrigem,
              ncm_raw: ncmOrigem,
              linha_id_raw: txt(o.LinhaId) || null,
              linha_raw: txt(o.LinhaNome) || null,
              url_raw: foto(o),
            },
          })
          .select('id')
          .single()
        if (erroInsert) throw erroInsert
        produtoId = novo.id
        importados += 1
        indice.set(codigoNorm, [{ id: produtoId, codigo, codigo_origem: codigo }])
      }

      snapshots.push({
        tipo,
        codigo,
        produto_atlas_id: produtoId,
        produto_wvetro_id: txt(o.ProdutoId ?? o.produtoId) || null,
        seu_codigo: txt(o.ProdutoSeuCodigo) || null,
        descricao: txt(o.ProdutoDescricao) || null,
        ativo: o.ProdutoAtivo === undefined ? null : Boolean(o.ProdutoAtivo),
        linha_id_wvetro: txt(o.LinhaId) || null,
        linha_nome_wvetro: txt(o.LinhaNome) || null,
        especie_id: txt(o.EspecieId) || null,
        especie_nome: txt(o.EspecieNome) || null,
        tipo_id: txt(o.TipoId) || null,
        tipo_nome: txt(o.TipoNome) || null,
        unidade: txt(o.Unidade) || null,
        ncm: txt(o.ProdutoNCM) || null,
        url_origem: foto(o),
        payload: o,
        consultado_em: new Date().toISOString(),
        erro: candidatos.length > 1 ? 'Código encontrou mais de um produto Atlas.' : null,
      })
    }

    for (let i = 0; i < snapshots.length; i += 200) {
      const { error: erroSnapshot } = await supabaseAdmin
        .from('wvetro_produtos_snapshot')
        .upsert(snapshots.slice(i, i + 200), { onConflict: 'tipo,codigo' })
      if (erroSnapshot) throw erroSnapshot
    }

    return { suportado: true, quantidadeApi: unicos.size, existentes, importados, ambiguos }
  } catch (e) {
    return {
      suportado: false,
      quantidadeApi: 0,
      existentes: 0,
      importados: 0,
      ambiguos: 0,
      erro: e instanceof Error ? e.message : 'Falha na descoberta do catálogo.',
    }
  }
}
