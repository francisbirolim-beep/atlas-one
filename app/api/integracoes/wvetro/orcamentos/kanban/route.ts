import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { sincronizar } from '../sincronizar/route'
import type { UsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { nomesClientesCompativeis } from '@/lib/wvetroClienteIdentidade'
import { materializarPacoteTecnicoWVetro } from '@/lib/wvetroPacoteTecnicoServer'
import { POST as candidatosClienteWVetro } from '../candidatos-cliente/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function txt(...vs: unknown[]) {
  for (const v of vs) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

function num(v: unknown) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  let s = String(v).trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function norm(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function obj(v: unknown): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}
}

function nomeCliente(p: Record<string, any>) {
  return txt(p.PessoaNome, p.ClienteNome, p.NomeCliente, p.RazaoSocial, p.Nome)
}

function dataYmd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function juntarAnexos(a: any, b: any) {
  const saida: any[] = []
  const urls = new Set<string>()
  for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const chave = txt(item?.url) || JSON.stringify(item)
    if (!chave || urls.has(chave)) continue
    urls.add(chave)
    saida.push(item)
  }
  return saida
}

async function autenticarWVetroDoTenant(req: NextRequest): Promise<UsuarioTenant | null> {
  const usuario = await autenticarTenant(req)
  if (!usuario) return null
  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('slug,ativo')
    .eq('id', usuario.empresa_id)
    .maybeSingle()
  const slugPermitido = String(process.env.WVETRO_EMPRESA_SLUG || 'esquadrifacio').trim().toLowerCase()
  if (!empresa?.ativo || String(empresa.slug || '').trim().toLowerCase() !== slugPermitido) return null
  return usuario
}

async function listarRecentes(clienteNome: string) {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 6)
  const inicioYmd = dataYmd(inicio)
  const fimYmd = dataYmd(fim)

  const [payloadOrcamentos, payloadPedidos] = await Promise.all([
    consultarRecursoOperacionalWVetro('orcamentos', { inicio: inicioYmd, fim: fimYmd }),
    consultarRecursoOperacionalWVetro('pedidos', { inicio: inicioYmd, fim: fimYmd }),
  ])
  const stagingOrcamentos = transformarPayloadWVetroEmStaging('orcamentos', payloadOrcamentos)
  const stagingPedidos = transformarPayloadWVetroEmStaging('pedidos', payloadPedidos)

  const porNumero = new Map<string, { payload: Record<string, any>; fonte: 'orcamento' | 'pedido'; dataReferencia: string | null }>()
  for (const registro of stagingOrcamentos.registros) {
    const p = obj(registro.payload)
    const numero = txt(p.Nro, p.OrcamentoId, p.Orcamentoid)
    if (numero) porNumero.set(numero, { payload: p, fonte: 'orcamento', dataReferencia: registro.dataReferencia })
  }
  for (const registro of stagingPedidos.registros) {
    const p = obj(registro.payload)
    const numero = txt(p.Nro, p.OrcamentoId, p.Orcamentoid)
    if (numero) porNumero.set(numero, { payload: p, fonte: 'pedido', dataReferencia: registro.dataReferencia })
  }

  const todos = Array.from(porNumero.entries()).map(([numero, x]) => ({
    numero,
    cliente: nomeCliente(x.payload) || 'Cliente sem nome',
    valor: num(x.payload.ValorTotal ?? x.payload.Total ?? x.payload.ValorBruto ?? x.payload.Valor),
    situacao: txt(x.payload.Situacao, x.payload.Status) || null,
    data: txt(x.payload.DtEmissao, x.payload.Data, x.dataReferencia) || null,
    fonte: x.fonte,
  })).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))

  const nome = norm(clienteNome)
  const exatos = todos.filter(o => nome && norm(o.cliente) === nome)
  return { inicio: inicioYmd, fim: fimYmd, todos, exatos }
}

async function consultarCandidatosHistoricos(
  req: NextRequest,
  clienteId: string,
  acao: 'buscar' | 'aprovar' = 'buscar',
  historicoId?: string,
) {
  if (!clienteId) return { candidatos: [] as any[] }
  const authorization = req.headers.get('authorization') || ''
  const subReq = new NextRequest(
    new URL('/api/integracoes/wvetro/orcamentos/candidatos-cliente', req.nextUrl.origin),
    {
      method: 'POST',
      headers: {
        authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ acao, clienteId, historicoId }),
    },
  )
  const resp = await candidatosClienteWVetro(subReq)
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json?.error || 'Falha ao consultar o histórico W.Vetro deste cliente.')
  }
  return json as Record<string, any>
}

function candidatoHistoricoParaKanban(c: any) {
  return {
    numero: txt(c?.numeroWvetro),
    cliente: txt(c?.clienteNomeWvetro) || 'Cliente sem nome',
    valor: num(c?.valor),
    situacao: txt(c?.situacao) || null,
    data: txt(c?.data) || null,
    fonte: 'historico' as const,
    nome_exato: c?.tipoCorrespondencia === 'nome_exato',
    atlas_id: c?.orcamentoAtlasId || null,
    atlas_numero: null,
    historico_id: txt(c?.historicoId) || null,
    quantidade_itens: Number(c?.quantidadeItens || 0),
    tipo_correspondencia: txt(c?.tipoCorrespondencia) || null,
    status_validacao: txt(c?.statusValidacao) || 'pendente',
  }
}

function valorPreenchido(v: any) {
  return !(v === null || v === undefined || v === '')
}

function mesclarItensPreservandoMedicao(alvoItensRaw: any, fonteItensRaw: any) {
  const alvoItens = Array.isArray(alvoItensRaw) ? alvoItensRaw : []
  const fonteItens = Array.isArray(fonteItensRaw) ? fonteItensRaw : []

  if (!alvoItens.length) return { itens: fonteItens, divergencia: false }
  if (!fonteItens.length) return { itens: alvoItens, divergencia: false }
  if (alvoItens.length !== fonteItens.length) {
    return { itens: alvoItens, divergencia: true }
  }

  const camposSempreDoCampo = [
    'id',
    'foto_url',
    'foto_larguras_url',
    'foto_alturas_url',
    'largura_baixo_mm',
    'largura_meio_mm',
    'largura_cima_mm',
    'altura_direita_mm',
    'altura_meio_mm',
    'altura_esquerda_mm',
    'tipo_medida',
  ]

  const camposManuaisQuandoPreenchidos = [
    'ambiente',
    'descricao',
    'observacao_producao',
    'observacao_tempera',
    'contramarco',
    'cor',
  ]

  const itens = fonteItens.map((fonte: any, indice: number) => {
    const alvo = alvoItens[indice] || {}
    const merged: Record<string, any> = { ...(fonte || {}) }

    for (const campo of camposSempreDoCampo) {
      if (valorPreenchido(alvo?.[campo])) merged[campo] = alvo[campo]
    }
    for (const campo of camposManuaisQuandoPreenchidos) {
      if (valorPreenchido(alvo?.[campo])) merged[campo] = alvo[campo]
    }

    const fotos = [
      ...(Array.isArray(fonte?.foto_urls) ? fonte.foto_urls : []),
      ...(Array.isArray(alvo?.foto_urls) ? alvo.foto_urls : []),
      alvo?.foto_url,
      alvo?.foto_larguras_url,
      alvo?.foto_alturas_url,
    ].filter(Boolean)
    merged.foto_urls = Array.from(new Set(fotos))
    if (alvo?.foto_url) merged.foto_url = alvo.foto_url

    // Medida final coletada em campo sempre tem precedência sobre largura/altura
    // comerciais do orçamento de origem.
    if (String(alvo?.tipo_medida || '').toLowerCase() === 'final') {
      if (valorPreenchido(alvo?.largura_mm)) merged.largura_mm = alvo.largura_mm
      if (valorPreenchido(alvo?.altura_mm)) merged.altura_mm = alvo.altura_mm
      merged.tipo_medida = 'final'
    }

    return merged
  })

  return { itens, divergencia: false }
}

async function inserirHistorico(orcamentoId: string, usuario: UsuarioTenant, acao: string, detalhes: string) {
  await supabaseAdmin.from('historico').insert({
    orcamento_id: orcamentoId,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome || 'Sistema',
    acao,
    detalhes,
  })
}

async function mesclarFonteNoCard(empresaId: string, alvo: any, fonte: any, usuario: UsuarioTenant) {
  const fluxoFonte = obj(fonte.wvetro_fluxo)
  const anexos = juntarAnexos(alvo.anexos, fonte.anexos)
  const mesclaItens = mesclarItensPreservandoMedicao(alvo.itens, fonte.itens)
  const patch: Record<string, any> = {
    // Traz a base técnica do W.Vetro sem apagar fotos e medidas coletadas em campo.
    itens: mesclaItens.itens,
    tipo_esquadria: fonte.tipo_esquadria,
    largura_mm: fonte.largura_mm,
    altura_mm: fonte.altura_mm,
    quantidade: fonte.quantidade,
    valor_estimado: fonte.valor_estimado,
    margem_padrao_pct: fonte.margem_padrao_pct,
    margem_padrao_origem: fonte.margem_padrao_origem,
    margem_regra_cidade_id: fonte.margem_regra_cidade_id,
    wvetro_fluxo: {
      ...fluxoFonte,
      vinculado_manualmente_em: new Date().toISOString(),
      vinculado_manualmente_por_id: usuario.id,
      vinculado_manualmente_por_nome: usuario.nome,
      itens_preservados_por_divergencia: mesclaItens.divergencia || undefined,
    },

    // REGRA DE PRESERVAÇÃO: dados já informados no card não são apagados.
    cliente_id: alvo.cliente_id || fonte.cliente_id || null,
    cliente_nome: alvo.cliente_nome || fonte.cliente_nome,
    cliente_whatsapp: alvo.cliente_whatsapp || fonte.cliente_whatsapp || null,
    cidade: alvo.cidade || fonte.cidade || null,
    acabamento: alvo.acabamento || fonte.acabamento || null,
    anexos,
    updated_at: new Date().toISOString(),
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from('orcamentos')
    .update(patch)
    .eq('empresa_id', empresaId)
    .eq('id', alvo.id)
    .select('*')
    .single()
  if (error) throw error

  if (fonte.id !== alvo.id) {
    const fluxoOculto = {
      ...fluxoFonte,
      vinculado_ao_orcamento_id: alvo.id,
      oculto_por_vinculo: true,
      ocultado_em: new Date().toISOString(),
    }
    const { error: esconderErro } = await supabaseAdmin
      .from('orcamentos')
      .update({
        modo_entrada: 'wvetro_api_vinculado',
        wvetro_fluxo: fluxoOculto,
        updated_at: new Date().toISOString(),
      })
      .eq('empresa_id', empresaId)
      .eq('id', fonte.id)
    if (esconderErro) throw esconderErro
  }

  return { atualizado, divergenciaItens: mesclaItens.divergencia }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarWVetroDoTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sem acesso à integração W.Vetro.' }, { status: 401 })
    const body = await req.json().catch(() => ({})) as Record<string, any>
    const acao = txt(body.acao)
    const cardId = txt(body.cardId)

    if (!cardId) return NextResponse.json({ error: 'Orçamento do Kanban não informado.' }, { status: 400 })

    const { data: alvo, error: alvoErro } = await supabaseAdmin
      .from('orcamentos')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', cardId)
      .maybeSingle()
    if (alvoErro) throw alvoErro
    if (!alvo) return NextResponse.json({ error: 'Orçamento do Kanban não encontrado.' }, { status: 404 })

    if (acao === 'buscar') {
      let recentes: Awaited<ReturnType<typeof listarRecentes>> | null = null
      let erroApiRecente = ''
      try {
        recentes = await listarRecentes(alvo.cliente_nome)
      } catch (e) {
        erroApiRecente = e instanceof Error ? e.message : 'API W.Vetro indisponível.'
      }

      const candidatosRecentes = (recentes?.todos || [])
        .filter(c => nomesClientesCompativeis(c.cliente, alvo.cliente_nome))
        .slice(0, 50)

      let candidatosHistoricos: any[] = []
      if (alvo.cliente_id) {
        try {
          const historicoJson = await consultarCandidatosHistoricos(req, alvo.cliente_id, 'buscar')
          candidatosHistoricos = (historicoJson.candidatos || [])
            .filter((x: any) => !['rejeitado', 'outro_cliente'].includes(String(x?.statusValidacao || '')))
            .map(candidatoHistoricoParaKanban)
        } catch (e) {
          console.warn('Falha ao complementar candidatos históricos W.Vetro no Kanban:', e)
        }
      }

      const numerosRecentes = candidatosRecentes.map(c => c.numero)
      const { data: locais } = numerosRecentes.length
        ? await supabaseAdmin
            .from('orcamentos')
            .select('id,numero,wvetro_fluxo,modo_entrada')
            .eq('empresa_id', usuario.empresa_id)
            .in('modo_entrada', ['wvetro_api', 'wvetro_api_vinculado'])
        : { data: [] as any[] }

      const localPorNumero = new Map<string, any>()
      for (const o of locais || []) {
        const n = txt(obj(o.wvetro_fluxo).numero)
        if (n && numerosRecentes.includes(n) && o.modo_entrada !== 'wvetro_api_vinculado') localPorNumero.set(n, o)
      }

      const porNumero = new Map<string, any>()
      for (const c of candidatosHistoricos) {
        if (c.numero) porNumero.set(c.numero, c)
      }
      for (const c of candidatosRecentes) {
        const historico = porNumero.get(c.numero)
        porNumero.set(c.numero, {
          ...historico,
          ...c,
          fonte: c.fonte,
          nome_exato: norm(c.cliente) === norm(alvo.cliente_nome),
          atlas_id: localPorNumero.get(c.numero)?.id || historico?.atlas_id || null,
          atlas_numero: localPorNumero.get(c.numero)?.numero || historico?.atlas_numero || null,
          historico_id: historico?.historico_id || null,
          quantidade_itens: historico?.quantidade_itens || 0,
          status_validacao: historico?.status_validacao || 'pendente',
        })
      }

      const candidatos = Array.from(porNumero.values()).sort((a, b) =>
        String(b.data || '').localeCompare(String(a.data || ''))
      )

      return NextResponse.json({
        ok: true,
        cliente: alvo.cliente_nome,
        inicio: recentes?.inicio || null,
        fim: recentes?.fim || null,
        candidatos,
        autoVincularNumero: null,
        mensagem: candidatos.length
          ? `${candidatos.length} orçamento(s) W.Vetro encontrado(s), incluindo o histórico. Escolha o número correto para vincular.`
          : erroApiRecente
            ? `Nenhum candidato salvo foi encontrado e a consulta recente do W.Vetro falhou: ${erroApiRecente}`
            : 'Nenhum orçamento W.Vetro compatível foi encontrado para este cliente.',
      })
    }

    if (acao === 'vincular') {
      const numeroWvetro = txt(body.numeroWvetro)
      if (!numeroWvetro) return NextResponse.json({ error: 'Escolha o orçamento W.Vetro.' }, { status: 400 })

      let recentes: Awaited<ReturnType<typeof listarRecentes>> | null = null
      try {
        recentes = await listarRecentes(alvo.cliente_nome)
      } catch (e) {
        console.warn('Consulta recente W.Vetro indisponível; tentando histórico salvo:', e)
      }
      const candidatoRecente = (recentes?.todos || []).find(c => c.numero === numeroWvetro) || null

      let candidatoHistorico: any = null
      if (alvo.cliente_id) {
        const histJson = await consultarCandidatosHistoricos(req, alvo.cliente_id, 'buscar')
        candidatoHistorico = (histJson.candidatos || []).find((x: any) =>
          txt(x?.numeroWvetro) === numeroWvetro &&
          !['rejeitado', 'outro_cliente'].includes(String(x?.statusValidacao || ''))
        ) || null
      }

      const nomeCandidato = candidatoRecente?.cliente || candidatoHistorico?.clienteNomeWvetro || ''
      if (!candidatoRecente && !candidatoHistorico) {
        return NextResponse.json({
          error: 'O orçamento escolhido não foi encontrado nem na consulta recente nem no histórico W.Vetro salvo no Atlas.',
        }, { status: 404 })
      }
      if (!nomesClientesCompativeis(nomeCandidato, alvo.cliente_nome)) {
        return NextResponse.json({
          error: `O W.Vetro #${numeroWvetro} pertence a "${nomeCandidato}" e não pode ser vinculado ao cliente "${alvo.cliente_nome}".`,
        }, { status: 409 })
      }

      // Candidato histórico: o clique "Usar este" é a validação humana do nome+número.
      // Reutiliza a mesma regra segura da Medida Final, inclusive para orçamentos antigos.
      if (candidatoHistorico?.historicoId && alvo.cliente_id) {
        const aprovado = await consultarCandidatosHistoricos(
          req,
          alvo.cliente_id,
          'aprovar',
          String(candidatoHistorico.historicoId),
        )
        const fonteId = txt(aprovado?.orcamentoAtlasId)
        if (!fonteId) throw new Error('O histórico foi validado, mas o orçamento Atlas de apoio não foi criado.')

        const { data: fonte, error: fonteErro } = await supabaseAdmin
          .from('orcamentos')
          .select('*')
          .eq('empresa_id', usuario.empresa_id)
          .eq('id', fonteId)
          .maybeSingle()
        if (fonteErro) throw fonteErro
        if (!fonte) throw new Error('Orçamento W.Vetro validado não encontrado no Atlas.')

        const resultadoMescla = fonte.id === alvo.id
          ? { atualizado: fonte, divergenciaItens: false }
          : await mesclarFonteNoCard(usuario.empresa_id, alvo, fonte, usuario)

        await inserirHistorico(
          alvo.id,
          usuario,
          'Vinculou orçamento histórico do W.Vetro',
          `W.Vetro #${numeroWvetro} validado manualmente para ${alvo.cliente_nome}. Fotos e medidas de campo do Atlas foram preservadas.`,
        )

        return NextResponse.json({
          ok: true,
          orcamento: resultadoMescla.atualizado,
          numeroWvetro,
          ocultadoId: fonte.id !== alvo.id ? fonte.id : null,
          divergenciaItens: resultadoMescla.divergenciaItens,
          mensagem: resultadoMescla.divergenciaItens
            ? `W.Vetro #${numeroWvetro} vinculado. Como a quantidade de itens é diferente, as tipologias atuais do Atlas foram preservadas para conferência.`
            : `W.Vetro #${numeroWvetro} vinculado. Dados técnicos foram atualizados sem apagar fotos nem medidas de campo.`,
        })
      }

      if (!recentes || !candidatoRecente) {
        return NextResponse.json({ error: 'Não foi possível recuperar o orçamento escolhido na API W.Vetro.' }, { status: 502 })
      }

      const { data: existentes } = await supabaseAdmin
        .from('orcamentos')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .contains('wvetro_fluxo', { numero: numeroWvetro })

      const ativoExistente = (existentes || []).find((o: any) => o.id !== alvo.id && o.modo_entrada !== 'wvetro_api_vinculado') || null

      if (!ativoExistente) {
        const fluxoAtual = obj(alvo.wvetro_fluxo)
        const { error: preErro } = await supabaseAdmin
          .from('orcamentos')
          .update({
            wvetro_fluxo: {
              ...fluxoAtual,
              numero: numeroWvetro,
              origem: 'wvetro_vinculo_pendente',
              vinculo_solicitado_em: new Date().toISOString(),
              vinculo_solicitado_por_id: usuario.id,
              vinculo_solicitado_por_nome: usuario.nome,
            },
          })
          .eq('empresa_id', usuario.empresa_id)
          .eq('id', alvo.id)
        if (preErro) throw preErro
      }

      const reqSync = new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/sincronizar', req.nextUrl.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inicio: recentes.inicio,
          fim: recentes.fim,
          forcar: true,
          numerosWvetro: [numeroWvetro],
          modo: 'vincular_kanban',
          clienteAlvoId: alvo.cliente_id || null,
        }),
      })
      const syncResp = await sincronizar(reqSync, usuario as UsuarioWVetro, 7)
      const syncJson = await syncResp.json().catch(() => ({}))
      if (!syncResp.ok) return NextResponse.json({ error: syncJson?.error || 'Falha ao sincronizar o orçamento W.Vetro.' }, { status: syncResp.status })

      const { data: aposSync, error: buscaErro } = await supabaseAdmin
        .from('orcamentos')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .contains('wvetro_fluxo', { numero: numeroWvetro })
      if (buscaErro) throw buscaErro

      const alvoAtual = (aposSync || []).find((o: any) => o.id === alvo.id) || alvo
      const fonteAtual = (aposSync || []).find((o: any) => o.id !== alvo.id && o.modo_entrada !== 'wvetro_api_vinculado') || null
      const resultadoMescla = fonteAtual
        ? await mesclarFonteNoCard(usuario.empresa_id, alvoAtual, fonteAtual, usuario)
        : { atualizado: alvoAtual, divergenciaItens: false }

      await inserirHistorico(
        alvo.id,
        usuario,
        'Sincronizou orçamento do W.Vetro',
        `W.Vetro #${numeroWvetro} vinculado ao card. Fotos, medidas e anexos existentes foram preservados.`,
      )

      return NextResponse.json({
        ok: true,
        orcamento: resultadoMescla.atualizado,
        numeroWvetro,
        ocultadoId: fonteAtual?.id || null,
        divergenciaItens: resultadoMescla.divergenciaItens,
        mensagem: resultadoMescla.divergenciaItens
          ? `W.Vetro #${numeroWvetro} vinculado, mas os itens têm quantidades diferentes. O Atlas preservou as tipologias atuais para conferência.`
          : `Orçamento W.Vetro #${numeroWvetro} sincronizado sem apagar fotos nem medidas de campo.`,
      })
    }

    if (acao === 'validar_importacao') {
      const fluxoAtual = obj(alvo.wvetro_fluxo)
      const numeroWvetro = txt(fluxoAtual.numero, fluxoAtual.numero_wvetro)
      const origemWvetro = txt(fluxoAtual.origem).toLowerCase().includes('wvetro')
      if (!numeroWvetro || !origemWvetro) {
        return NextResponse.json({ error: 'Este card não é um orçamento importado do W.Vetro.' }, { status: 409 })
      }

      const agora = new Date().toISOString()
      const fluxoValidado = {
        ...fluxoAtual,
        validacao_status: 'validado',
        validado_em: agora,
        validado_por_id: usuario.id,
        validado_por_nome: usuario.nome || 'Usuário',
      }

      const { data: atualizado, error: validarErro } = await supabaseAdmin
        .from('orcamentos')
        .update({
          wvetro_fluxo: fluxoValidado,
          updated_at: agora,
        })
        .eq('empresa_id', usuario.empresa_id)
        .eq('id', alvo.id)
        .select('*')
        .single()
      if (validarErro) throw validarErro

      const pacoteTecnico = await materializarPacoteTecnicoWVetro(alvo.id, usuario)
        .catch((erro) => ({
          ok: false as const,
          error: erro instanceof Error ? erro.message : 'Falha ao gerar pacote técnico W.Vetro.',
        }))

      await inserirHistorico(
        alvo.id,
        usuario,
        'Validou orçamento importado do W.Vetro',
        pacoteTecnico.ok
          ? `W.Vetro #${numeroWvetro} conferido, liberado e com pacote técnico de materiais gerado.`
          : `W.Vetro #${numeroWvetro} conferido e liberado. Pacote técnico pendente: ${pacoteTecnico.error}`,
      )

      return NextResponse.json({
        ok: true,
        orcamento: atualizado,
        numeroWvetro,
        pacoteTecnico,
        mensagem: pacoteTecnico.ok
          ? `Orçamento W.Vetro #${numeroWvetro} validado com materiais técnicos carregados.`
          : `Orçamento W.Vetro #${numeroWvetro} validado. Materiais ainda precisam ser sincronizados: ${pacoteTecnico.error}`,
      })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro na sincronização W.Vetro pelo Kanban:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar W.Vetro no Kanban.' }, { status: 500 })
  }
}
