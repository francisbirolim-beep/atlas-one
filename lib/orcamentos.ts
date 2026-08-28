import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { uploadFoto, uploadArquivo } from './upload'
import { usuarioAtual, tokenAtual } from './auth'
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

type LeituraTrena = {
  medidas_mm: number[]
  confianca: number
  observacao?: string
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

async function lerTrenaPorFoto(imageUrl: string, eixo: 'largura' | 'altura'): Promise<LeituraTrena | null> {
  try {
    const token = await tokenAtual()
    if (!token) return null

    const resposta = await fetch('/api/medicao-final/ler-trena', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl, eixo }),
    })
    const json = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      console.warn('Foto salva, mas a leitura automática da trena não foi concluída:', json?.error || resposta.statusText)
      return null
    }

    const medidas = Array.isArray(json?.medidas_mm)
      ? json.medidas_mm
          .map((v: unknown) => Number(v))
          .filter((v: number) => Number.isFinite(v) && v > 0 && v <= 10000)
          .slice(0, 3)
      : []
    if (medidas.length === 0) return null

    return {
      medidas_mm: medidas,
      confianca: Number(json?.confianca) || 0,
      observacao: typeof json?.observacao === 'string' ? json.observacao : undefined,
    }
  } catch (error) {
    console.warn('Foto salva, mas ocorreu erro ao solicitar leitura da trena:', error)
    return null
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

  const [clienteId, colunaId, usuario, referenciasWvetro] = await Promise.all([
    clienteIdInformado
      ? Promise.resolve(clienteIdInformado)
      : obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
    primeiraColunaId(),
    usuarioAtual(),
    carregarReferenciasWvetroSnapshot(),
  ])

  const itensSalvos: ItemEsquadria[] = []
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

      let lb = usaFotoLargura ? NaN : parseFloat(it.larguraBaixo.replace(',', '.'))
      let lm = usaFotoLargura ? NaN : parseFloat(it.larguraMeio.replace(',', '.'))
      let lc = usaFotoLargura ? NaN : parseFloat(it.larguraCima.replace(',', '.'))
      let ad = usaFotoAltura ? NaN : parseFloat(it.alturaDireita.replace(',', '.'))
      let am = usaFotoAltura ? NaN : parseFloat(it.alturaMeio.replace(',', '.'))
      let ae = usaFotoAltura ? NaN : parseFloat(it.alturaEsquerda.replace(',', '.'))

      const foto_larguras_url = usaFotoLargura && it.fotoLargura ? await uploadFoto(it.fotoLargura) : null
      const foto_alturas_url = usaFotoAltura && it.fotoAltura ? await uploadFoto(it.fotoAltura) : null

      // Foto e medida são duas informações diferentes: a foto SEMPRE permanece salva.
      // Depois do upload, a IA tenta ler o visor e preencher os campos numéricos.
      if (foto_larguras_url) {
        const leituraLargura = await lerTrenaPorFoto(foto_larguras_url, 'largura')
        if (leituraLargura?.medidas_mm.length) {
          lb = leituraLargura.medidas_mm[0] ?? NaN
          lm = leituraLargura.medidas_mm[1] ?? NaN
          lc = leituraLargura.medidas_mm[2] ?? NaN
        }
      }
      if (foto_alturas_url) {
        const leituraAltura = await lerTrenaPorFoto(foto_alturas_url, 'altura')
        if (leituraAltura?.medidas_mm.length) {
          ad = leituraAltura.medidas_mm[0] ?? NaN
          am = leituraAltura.medidas_mm[1] ?? NaN
          ae = leituraAltura.medidas_mm[2] ?? NaN
        }
      }

      // Compatibilidade com a edição atual do Kanban: além dos campos específicos,
      // as fotos da trena também entram em foto_url/foto_urls para continuarem visíveis.
      const todasFotosItem = Array.from(new Set([
        ...itemFotoUrls,
        ...(foto_larguras_url ? [foto_larguras_url] : []),
        ...(foto_alturas_url ? [foto_alturas_url] : []),
      ]))
      const foto_url = todasFotosItem[0] || null
      const foto_urls = todasFotosItem.length ? todasFotosItem : null

      itensSalvos.push({
        id: it.id,
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo as TipoEsquadria,
        tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
        folhas: it.folhas || null,
        largura_mm: Number.isFinite(lm) ? lm : null,
        altura_mm: Number.isFinite(am) ? am : null,
        largura_baixo_mm: Number.isFinite(lb) ? lb : null,
        largura_meio_mm: Number.isFinite(lm) ? lm : null,
        largura_cima_mm: Number.isFinite(lc) ? lc : null,
        altura_direita_mm: Number.isFinite(ad) ? ad : null,
        altura_meio_mm: Number.isFinite(am) ? am : null,
        altura_esquerda_mm: Number.isFinite(ae) ? ae : null,
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
      const foto_url = itemFotoUrls[0] || null
      const foto_urls = itemFotoUrls.length ? itemFotoUrls : null
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