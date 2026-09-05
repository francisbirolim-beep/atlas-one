import { supabase } from './supabase'
import { tokenAtual } from './auth'
import { salvarConfiguracaoGeralTenant } from './configuracoesGeraisTenant'
import {
    MedicaoColuna, MedicaoFinal, MedicaoItem, TipologiaCampoExtra, TipoValorCampoExtra,
    Usuario, ItemEsquadria,
} from './tipos'

const COLUNA_1 = 'Aguardando medida final'
const COLUNA_2 = 'Liberado para medir'
const CHAVE_LIMITE_DIFERENCA = 'medicao_alerta_diferenca_mm'
const LIMITE_DIFERENCA_PADRAO = 100

// ---------- Colunas do quadro ----------

export async function listarColunasMedicao(): Promise<MedicaoColuna[]> {
    const { data, error } = await supabase
      .from('medicao_colunas')
      .select('*')
      .order('ordem', { ascending: true })

  if (error || !data) {
        console.error('Erro ao listar colunas de medicao:', error)
        return []
  }

  if (data.length === 0) {
        return await criarColunasPadrao()
  }

  return data as MedicaoColuna[]
}

async function criarColunasPadrao(): Promise<MedicaoColuna[]> {
    const { data, error } = await supabase
      .from('medicao_colunas')
      .insert([
        { nome: COLUNA_1, ordem: 0 },
        { nome: COLUNA_2, ordem: 1 },
            ])
      .select()

  if (error || !data) {
        console.error('Erro ao criar colunas padrao de medicao:', error)
        return []
  }
    return data as MedicaoColuna[]
}

export async function criarColunaMedicao(nome: string): Promise<MedicaoColuna | null> {
    const { data: colunas } = await supabase
      .from('medicao_colunas')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)

  const proximaOrdem = colunas && colunas.length > 0 ? colunas[0].ordem + 1 : 0

           const { data, error } = await supabase
      .from('medicao_colunas')
      .insert({ nome, ordem: proximaOrdem })
      .select()
      .single()

  if (error) {
        console.error('Erro ao criar coluna de medicao:', error)
        return null
  }
    return data as MedicaoColuna
}

export async function renomearColunaMedicao(id: string, nome: string): Promise<boolean> {
    const { error } = await supabase.from('medicao_colunas').update({ nome }).eq('id', id)
    return !error
}

export async function excluirColunaMedicao(id: string, colunaDestinoId: string): Promise<boolean> {
    const { error: moveError } = await supabase
      .from('medicoes_finais')
      .update({ coluna_id: colunaDestinoId })
      .eq('coluna_id', id)

  if (moveError) {
        console.error('Erro ao mover cards antes de excluir coluna:', moveError)
        return false
  }

        const { error } = await supabase.from('medicao_colunas').delete().eq('id', id)
    return !error
}

// ---------- Medições (cards) ----------

export async function listarMedicoes(): Promise<MedicaoFinal[]> {
    const { data, error } = await supabase
      .from('medicoes_finais')
      .select('*')
      .order('created_at', { ascending: true })

  if (error || !data) {
        console.error('Erro ao listar medicoes:', error)
        return []
  }
    return data as MedicaoFinal[]
}

// Orçamentos que estão numa coluna do Kanban Comercial marcada como "vendido"
// (kanban_colunas.gera_medicao_final = true) e ainda não têm uma medição
// final criada, pra aparecer no seletor de "Nova medição". Usa a coluna do
// Kanban como critério, não o campo orcamentos.status: na prática o status
// não é mantido em sincronia com a posição do card no quadro.
// Orçamentos de apoio criados pelo fluxo W.Vetro são internos e não pertencem
// ao bloco "OU USAR ORÇAMENTO DO ATLAS"; eles continuam preservados no banco
// e são tratados exclusivamente pelo importador W.Vetro.
export async function listarOrcamentosSemMedicao(): Promise<
{ id: string; cliente_nome: string; cidade: string | null; created_at: string }[]
  > {
    const { data: colunasVendido, error: erroColunas } = await supabase
      .from('kanban_colunas')
      .select('id')
      .eq('gera_medicao_final', true)

  if (erroColunas) {
        console.error('Erro ao buscar colunas de venda do Kanban:', erroColunas)
        return []
  }

  const idsColunasVendido = (colunasVendido || []).map((c: any) => c.id)
    if (idsColunasVendido.length === 0) return []

        const [{ data: orcamentos }, { data: medicoes }] = await Promise.all([
              supabase
                .from('orcamentos')
                .select('id, cliente_nome, cidade, created_at, descricao_livre')
                .in('coluna_id', idsColunasVendido)
                .order('created_at', { ascending: false }),
              supabase.from('medicoes_finais').select('orcamento_id'),
            ])

  const jaTem = new Set((medicoes || []).map((m: any) => m.orcamento_id).filter(Boolean))
    return (orcamentos || []).filter((o: any) => {
      const ehApoioWVetro = String(o.descricao_livre || '').startsWith('Importado do W.Vetro |')
      return !jaTem.has(o.id) && !ehApoioWVetro
    })
}

// Cria a medição a partir de um orçamento vendido: puxa cliente/endereço e
// gera a lista de itens (uma linha por tipologia) a partir de orcamentos.itens.
export async function criarMedicaoDoOrcamento(
    orcamentoId: string,
    usuario: Usuario | null
  ): Promise<MedicaoFinal | null> {
    const { data: orcamento, error: erroOrcamento } = await supabase
      .from('orcamentos')
      .select('id, cliente_id, cliente_nome, cliente_whatsapp, cidade, itens, anexos')
      .eq('id', orcamentoId)
      .single()

  if (erroOrcamento || !orcamento) {
        console.error('Erro ao buscar orcamento para medicao:', erroOrcamento)
        return null
  }

  let endereco: string | null = null
    let bairro: string | null = null
    let cep: string | null = null

  if (orcamento.cliente_id) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('endereco, bairro, cep')
          .eq('id', orcamento.cliente_id)
          .maybeSingle()
        if (cliente) {
                endereco = cliente.endereco || null
                bairro = cliente.bairro || null
                cep = cliente.cep || null
        }
  }

  const colunas = await listarColunasMedicao()
    const primeiraColuna = colunas[0]

  const { data: medicao, error } = await supabase
      .from('medicoes_finais')
      .insert({
              orcamento_id: orcamento.id,
              cliente_id: orcamento.cliente_id || null,
              cliente_nome: orcamento.cliente_nome,
              cliente_whatsapp: orcamento.cliente_whatsapp || null,
              endereco,
              bairro,
              cep,
              cidade: orcamento.cidade || null,
              coluna_id: primeiraColuna?.id || null,
              coluna_atualizada_em: new Date().toISOString(),
              criado_por_id: usuario?.id || null,
              criado_por_nome: usuario?.nome || null,
      })
      .select()
      .single()

  if (error || !medicao) {
        console.error('Erro ao criar medicao:', error)
        return null
  }

  let itensOrcamento = (orcamento.itens as ItemEsquadria[] | null) || []

      if (itensOrcamento.length === 0) {
            itensOrcamento = await importarItensDoPdfDoOrcamento(orcamentoId)
      }

      if (itensOrcamento.length > 0) {
            const linhas = itensOrcamento.map((it, idx) => ({
                    medicao_id: medicao.id,
                    tipo_esquadria: it.tipo_esquadria,
                    tipo_outro_texto: it.tipo_outro_texto || null,
                    descricao: it.descricao || `Item ${idx + 1}`,
                    quantidade: it.quantidade || 1,
                    ordem: idx,
            }))
            const { error: erroItens } = await supabase.from('medicao_itens').insert(linhas)
            if (erroItens) console.error('Erro ao criar itens de medicao:', erroItens)
      }

  return medicao as MedicaoFinal
}

async function importarItensDoPdfDoOrcamento(orcamentoId: string): Promise<ItemEsquadria[]> {
  try {
    const token = await tokenAtual()
    const resp = await fetch('/api/importar-itens-orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify({ orcamentoId }),
    })
    if (!resp.ok) return []
    const json = await resp.json()
    return (json.itens as ItemEsquadria[]) || []
  } catch (e) {
    console.error('Erro ao importar itens do PDF automaticamente:', e)
    return []
  }
}

export async function moverMedicao(id: string, novaColunaId: string): Promise<boolean> {
    const { error } = await supabase
      .from('medicoes_finais')
      .update({ coluna_id: novaColunaId, coluna_atualizada_em: new Date().toISOString() })
      .eq('id', id)
    return !error
}

export async function excluirMedicao(id: string): Promise<boolean> {
    const { error } = await supabase.from('medicoes_finais').delete().eq('id', id)
    return !error
}

export async function buscarMedicao(id: string): Promise<MedicaoFinal | null> {
    const { data, error } = await supabase.from('medicoes_finais').select('*').eq('id', id).maybeSingle()
    if (error) {
          console.error('Erro ao buscar medicao:', error)
          return null
    }
    return (data as MedicaoFinal) || null
}

// ---------- Itens (tipologias) de uma medição ----------

export async function listarItensMedicao(medicaoId: string): Promise<MedicaoItem[]> {
    const { data, error } = await supabase
      .from('medicao_itens')
      .select('*')
      .eq('medicao_id', medicaoId)
      .order('ordem', { ascending: true })

  if (error || !data) {
        console.error('Erro ao listar itens de medicao:', error)
        return []
  }
    return data as MedicaoItem[]
}

export async function adicionarItemMedicao(
    medicaoId: string,
    tipoEsquadria: string,
    tipoOutroTexto: string | null,
    descricao: string,
    quantidade: number
  ): Promise<MedicaoItem | null> {
    const itensAtuais = await listarItensMedicao(medicaoId)
    const proximaOrdem = itensAtuais.length

  const { data, error } = await supabase
      .from('medicao_itens')
      .insert({
              medicao_id: medicaoId,
              tipo_esquadria: tipoEsquadria,
              tipo_outro_texto: tipoOutroTexto,
              descricao,
              quantidade,
              ordem: proximaOrdem,
      })
      .select()
      .single()

  if (error) {
        console.error('Erro ao adicionar item de medicao:', error)
        return null
  }
    return data as MedicaoItem
}

export async function editarItemMedicao(
    itemId: string,
    campos: { tipo_esquadria?: string; tipo_outro_texto?: string | null; descricao?: string; quantidade?: number }
  ): Promise<boolean> {
    const { error } = await supabase.from('medicao_itens').update(campos).eq('id', itemId)
    return !error
}

export async function removerItemMedicao(itemId: string): Promise<boolean> {
    const { error } = await supabase.from('medicao_itens').delete().eq('id', itemId)
    return !error
}

export interface DadosMedidaItem {
    largura_baixo_mm: number | null
    largura_meio_mm: number | null
    largura_cima_mm: number | null
    altura_direita_mm: number | null
    altura_meio_mm: number | null
    altura_esquerda_mm: number | null
    foto_larguras_url: string | null
    foto_alturas_url: string | null
    campos_extras: Record<string, string | number>
}

export async function salvarMedidaItem(
    itemId: string,
    dados: DadosMedidaItem,
    usuario: Usuario | null
  ): Promise<boolean> {
    const { error } = await supabase
      .from('medicao_itens')
      .update({
              ...dados,
              medido: true,
              medido_em: new Date().toISOString(),
              medido_por_id: usuario?.id || null,
              medido_por_nome: usuario?.nome || null,
      })
      .eq('id', itemId)
    return !error
}

export async function reabrirItemMedicao(itemId: string): Promise<boolean> {
    const { error } = await supabase.from('medicao_itens').update({ medido: false }).eq('id', itemId)
    return !error
}

// ---------- Campos extras por tipologia (configurável pelo master) ----------

export async function listarCamposExtras(tipoEsquadria: string): Promise<TipologiaCampoExtra[]> {
    const { data, error } = await supabase
      .from('tipologia_campos_extras')
      .select('*')
      .or(`tipo_esquadria.is.null,tipo_esquadria.eq.${tipoEsquadria}`)
      .order('tipo_esquadria', { ascending: true, nullsFirst: true })
      .order('ordem', { ascending: true })

  if (error || !data) return []
      return data as TipologiaCampoExtra[]
}

export async function listarTodosCamposExtras(): Promise<TipologiaCampoExtra[]> {
    const { data, error } = await supabase
      .from('tipologia_campos_extras')
      .select('*')
      .order('tipo_esquadria', { ascending: true, nullsFirst: true })
      .order('ordem', { ascending: true })

  if (error || !data) return []
      return data as TipologiaCampoExtra[]
}

export async function criarCampoExtra(
    tipoEsquadria: string | null,
    chave: string,
    nome: string,
    tipoValor: TipoValorCampoExtra,
    obrigatorio: boolean
  ): Promise<TipologiaCampoExtra | null> {
    const { data, error } = await supabase
      .from('tipologia_campos_extras')
      .insert({ tipo_esquadria: tipoEsquadria, chave, nome, tipo_valor: tipoValor, obrigatorio })
      .select()
      .single()

  if (error) {
          console.error('Erro ao criar campo extra:', error)
        return null
  }
    return data as TipologiaCampoExtra
}

export async function editarCampoExtra(
    id: string,
    nome: string,
    tipoValor: TipoValorCampoExtra,
    obrigatorio: boolean
  ): Promise<boolean> {
    const { error } = await supabase
      .from('tipologia_campos_extras')
      .update({ nome, tipo_valor: tipoValor, obrigatorio })
      .eq('id', id)
    return !error
}

export async function excluirCampoExtra(id: string): Promise<boolean> {
    const { error } = await supabase.from('tipologia_campos_extras').delete().eq('id', id)
    return !error
}

// ---------- Limite de alerta de diferença entre medidas ----------

export async function lerLimiteAlertaDiferenca(): Promise<number> {
    const { data } = await supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', CHAVE_LIMITE_DIFERENCA)
      .maybeSingle()
    const valor = data?.valor ? parseInt(data.valor, 10) : NaN
    return Number.isFinite(valor) ? valor : LIMITE_DIFERENCA_PADRAO
}

export async function salvarLimiteAlertaDiferenca(mm: number): Promise<boolean> {
    return salvarConfiguracaoGeralTenant(CHAVE_LIMITE_DIFERENCA, String(mm))
}
