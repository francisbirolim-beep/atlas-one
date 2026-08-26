import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { uploadFoto, uploadArquivo } from './upload'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { executarAutomacoesColuna } from './automacoes'
import { v4 as uuidv4 } from 'uuid'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, ItemEsquadria, TemperaturaLead, Anexo } from './tipos'

export interface ItemOrcamentoForm {
  id: string
  ambiente?: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  cor: string
  fotos: File[]
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  modoLargura?: 'digitar' | 'foto'
  modoAltura?: 'digitar' | 'foto'
  fotoLargura?: File | null
  fotoAltura?: File | null
  modoOrigem?: 'manual' | 'produto'
  produtoId?: string | null
  precoUnit?: number | null
  linhaId?: string | null
  linhaNome?: string | null
  tipologiaId?: string | null
  configuracaoPresetId?: string | null
  configuracaoNome?: string | null
  configuracaoValidada?: boolean
  modoConfiguracao?: 'rapido' | 'assistido'
  configuracaoStatus?: 'pendente' | 'preenchida' | 'validada'
  variaveis?: Record<string, string>
}

export interface DadosOrcamentoForm {
  clienteId?: string | null
  obraId?: string | null
  itens: ItemOrcamentoForm[]
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  origem: OrigemCliente
  temperatura: TemperaturaLead | ''
  acabamento: Acabamento | ''
  acabamentoOutroTexto: string
  contramarco: Contramarco | ''
  tipoMedida: 'comum' | 'final' | ''
  arquitetoNome: string
  arquitetoContato: string
  fotos: File[]
  arquivos: File[]
}

type ReferenciaVariavelSnapshot = {
  id: string
  chave: string
  valor: string
  valorRaw?: string | null
  origemTipo?: string | null
  evidencia?: string | null
}

type ReferenciaTipologiaSnapshot = {
  referenciaId: string
  tipologiaId: string
  linha: string
  modelo: string
  imagemUrl?: string | null
  ocorrencias?: number
  variaveis?: ReferenciaVariavelSnapshot[]
}

async function carregarReferenciasWvetroSnapshot(): Promise<Record<string, ReferenciaTipologiaSnapshot>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  try {
    const resposta = await fetch('/api/orcamento/wvetro-referencias', {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!resposta.ok) return {}
    const json = await resposta.json().catch(() => ({}))
    return (json?.referencias || {}) as Record<string, ReferenciaTipologiaSnapshot>
  } catch {
    // Falha de procedência não pode impedir o salvamento do orçamento.
    return {}
  }
}

export async function criarOrcamentoNoServidor(
  dados: DadosOrcamentoForm
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const {
    clienteId: clienteIdInformado,
    itens, clienteNome, clienteWhatsapp, cidade, origem,
    temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
    arquitetoNome, arquitetoContato, fotos, arquivos = [],
  } = dados
  const obraId = dados.obraId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('obra') : null)

  const [clienteId, colunaId, usuario, referenciasWvetro] = await Promise.all([
    clienteIdInformado
      ? Promise.resolve(clienteIdInformado)
      : obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
    primeiraColunaId(),
    usuarioAtual(),
    carregarReferenciasWvetroSnapshot(),
  ])

  let itensSalvos: ItemEsquadria[] = []
  const fotosUrls: string[] = []
  for (const foto of fotos) { const url = await uploadFoto(foto); if (url) fotosUrls.push(url) }
  const anexosSalvos: Anexo[] = []
  for (const arquivo of arquivos) {
    const url = await uploadArquivo(arquivo)
    if (url) anexosSalvos.push({ titulo: arquivo.name, nome: arquivo.name, url })
  }
  for (const it of itens) {
    const itemFotoUrls: string[] = []
    for (const f of it.fotos) { const url = await uploadFoto(f); if (url) itemFotoUrls.push(url) }
    const foto_url = itemFotoUrls[0] || null
    const foto_urls = itemFotoUrls.length ? itemFotoUrls : null

    const produto_id = it.modoOrigem === 'produto' ? (it.produtoId || null) : null
    const preco_unit = it.modoOrigem === 'produto' && it.precoUnit != null ? it.precoUnit : null
    const quantidadeNum = parseInt(it.quantidade) || 1
    const preco_total = preco_unit != null ? preco_unit * quantidadeNum : null

    const referencia = it.tipologiaId ? referenciasWvetro[it.tipologiaId] || null : null
    const variaveisUsadasWvetro = !it.configuracaoValidada && referencia
      ? (referencia.variaveis || []).filter(ref => {
          const valorSelecionado = it.variaveis?.[ref.chave]
          if (valorSelecionado) return valorSelecionado === ref.valor
          return ref.chave === 'folhas' && Boolean(it.folhas) && it.folhas === ref.valor
        })
      : []

    const referenciaWvetroSnapshot = referencia ? {
      referencia_id: referencia.referenciaId,
      tipologia_id: referencia.tipologiaId,
      linha: referencia.linha,
      modelo: referencia.modelo,
      imagem_url: referencia.imagemUrl || null,
      ocorrencias: Number(referencia.ocorrencias || 0),
      utilizada_como_base: !it.configuracaoValidada && variaveisUsadasWvetro.length > 0,
      variaveis_usadas: variaveisUsadasWvetro.map(ref => ({
        referencia_variavel_id: ref.id,
        chave: ref.chave,
        valor: ref.valor,
        valor_raw: ref.valorRaw || null,
        origem_tipo: ref.origemTipo || 'explicita_wvetro',
        evidencia: ref.evidencia || null,
      })),
    } : null

    const snapshotConfiguracao = {
      linha_id: it.linhaId || null,
      linha_nome: it.linhaNome || null,
      tipologia_id: it.tipologiaId || null,
      configuracao_preset_id: it.configuracaoPresetId || null,
      configuracao_nome: it.configuracaoNome || null,
      configuracao_validada: Boolean(it.configuracaoValidada),
      modo_configuracao: it.modoConfiguracao || 'rapido',
      configuracao_status: it.configuracaoStatus || (it.configuracaoValidada ? 'validada' : 'pendente'),
      variaveis: it.variaveis || {},
      referencia_wvetro: referenciaWvetroSnapshot,
    }

    if (tipoMedida === 'final') {
      const usaFotoLargura = it.modoLargura === 'foto'
      const usaFotoAltura = it.modoAltura === 'foto'
      const lb = usaFotoLargura ? NaN : parseFloat(it.larguraBaixo.replace(',', '.'))
      const lm = usaFotoLargura ? NaN : parseFloat(it.larguraMeio.replace(',', '.'))
      const lc = usaFotoLargura ? NaN : parseFloat(it.larguraCima.replace(',', '.'))
      const ad = usaFotoAltura ? NaN : parseFloat(it.alturaDireita.replace(',', '.'))
      const am = usaFotoAltura ? NaN : parseFloat(it.alturaMeio.replace(',', '.'))
      const ae = usaFotoAltura ? NaN : parseFloat(it.alturaEsquerda.replace(',', '.'))
      const foto_larguras_url = usaFotoLargura && it.fotoLargura ? await uploadFoto(it.fotoLargura) : null
      const foto_alturas_url = usaFotoAltura && it.fotoAltura ? await uploadFoto(it.fotoAltura) : null
      itensSalvos.push({
        id: it.id,
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo as TipoEsquadria,
        tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
        folhas: it.folhas || null,
        largura_mm: lm,
        altura_mm: am,
        largura_baixo_mm: lb,
        largura_meio_mm: lm,
        largura_cima_mm: lc,
        altura_direita_mm: ad,
        altura_meio_mm: am,
        altura_esquerda_mm: ae,
        foto_larguras_url,
        foto_alturas_url,
        quantidade: quantidadeNum,
        foto_url,
        foto_urls,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
        produto_id,
        preco_unit,
        preco_total,
        ...snapshotConfiguracao,
      })
    } else {
      itensSalvos.push({
        id: it.id,
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo as TipoEsquadria,
        tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
        folhas: it.folhas || null,
        largura_mm: parseFloat(it.largura),
        altura_mm: parseFloat(it.altura),
        quantidade: quantidadeNum,
        foto_url,
        foto_urls,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
        produto_id,
        preco_unit,
        preco_total,
        ...snapshotConfiguracao,
      })
    }
  }

  const primeiro = itensSalvos[0]
  const novoId = uuidv4()

  const { error } = await supabase.from('orcamentos').insert({
    id: novoId,
    cliente_id: clienteId,
    obra_id: obraId || null,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp,
    cidade,
    origem,
    tipo_esquadria: primeiro?.tipo_esquadria || 'outro',
    largura_mm: primeiro?.largura_mm || null,
    altura_mm: primeiro?.altura_mm || null,
    quantidade: primeiro?.quantidade || 1,
    acabamento,
    acabamento_outro_texto: acabamento === 'outro' ? acabamentoOutroTexto : null,
    temperatura,
    contramarco,
    itens: itensSalvos,
    fotos_urls: fotosUrls,
    anexos: anexosSalvos,
    tipo_medida: tipoMedida,
    descricao_livre: null,
    valor_estimado: null,
    status: 'rascunho',
    modo_entrada: 'formulario',
    coluna_id: colunaId,
    coluna_atualizada_em: new Date().toISOString(),
    arquiteto_nome: arquitetoNome || null,
    arquiteto_contato: arquitetoContato || null,
    criado_por_nome: usuario?.nome || null,
    criado_por_id: usuario?.id || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  if (colunaId) { executarAutomacoesColuna(colunaId, { cliente_nome: clienteNome, criado_por_id: usuario?.id || null }).catch(() => {}) }

  await registrarHistorico(novoId, usuario, 'Criou o orcamento')
  return { ok: true, id: novoId }
}