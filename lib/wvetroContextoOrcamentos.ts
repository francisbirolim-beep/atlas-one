import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Referencia = { id: string; numero_ref: unknown; numero_legado_ref: unknown }

function numeroWVetro(principal: unknown, legado: unknown): string {
  return String(principal ?? '').trim() || String(legado ?? '').trim()
}

const CAMPOS_REFERENCIA = 'id,numero_ref:wvetro_fluxo->numero,numero_legado_ref:wvetro_fluxo->numero_wvetro'
const CAMPOS_COMPLETOS = 'id,cliente_id,obra_id,cidade,valor_estimado,itens,anexos,wvetro_fluxo,updated_at,margem_padrao_pct,margem_padrao_origem,margem_regra_cidade_id,modo_entrada,coluna_id'

// Primeiro lê somente a referência externa de cada orçamento da empresa.
// Os JSONs completos são necessários apenas aos registros da janela importada.
export async function carregarOrcamentosContextoWVetro(empresaId: string, numeros: ReadonlySet<string>) {
  if (!numeros.size) return []
  const selecionados = new Map<string, string>()
  const pagina = 200
  for (let inicio = 0;; inicio += pagina) {
    const { data, error } = await supabaseAdmin.from('orcamentos')
      .select(CAMPOS_REFERENCIA).eq('empresa_id', empresaId)
      .order('id', { ascending: true }).range(inicio, inicio + pagina - 1)
    if (error) throw error
    const refs = (data || []) as unknown as Referencia[]
    for (const r of refs) {
      const numero = numeroWVetro(r.numero_ref, r.numero_legado_ref)
      if (numeros.has(numero)) selecionados.set(r.id, numero)
    }
    if (refs.length < pagina) break
  }
  const ids = [...selecionados.keys()]
  const registros: any[] = []
  // Lotes pequenos para não estourar timeout na serialização de itens e anexos.
  for (let inicio = 0; inicio < ids.length; inicio += 12) {
    const lote = ids.slice(inicio, inicio + 12)
    const { data, error } = await supabaseAdmin.from('orcamentos')
      .select(CAMPOS_COMPLETOS).eq('empresa_id', empresaId).in('id', lote)
      .order('id', { ascending: true })
    if (error) throw error
    const linhas = data || []
    if (linhas.length !== lote.length || linhas.some((r: any) =>
      numeroWVetro(r.wvetro_fluxo?.numero, r.wvetro_fluxo?.numero_wvetro) !== selecionados.get(r.id))) {
      // Se outro processo mudou a referência durante a leitura, não importar
      // como novo um orçamento que já existia. A próxima execução relê o estado.
      throw new Error('Referências W.Vetro alteradas durante a sincronização. Tente novamente.')
    }
    registros.push(...linhas)
  }
  return registros
}
