import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { sincronizar } from '../sincronizar/route'
import type { UsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { nomesClientesCompativeis } from '@/lib/wvetroClienteIdentidade'
import { materializarPacoteTecnicoWVetro } from '@/lib/wvetroPacoteTecnicoServer'

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
  const patch: Record<string, any> = {
    // Campos técnicos/comerciais que a ação "Sincronizar W.Vetro" explicitamente pediu para atualizar.
    itens: fonte.itens,
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

  return atualizado
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
      const recentes = await listarRecentes(alvo.cliente_nome)
      const candidatosBase = recentes.todos.filter(c => nomesClientesCompativeis(c.cliente, alvo.cliente_nome)).slice(0, 50)
      const numeros = candidatosBase.map(c => c.numero)
      const { data: locais } = numeros.length
        ? await supabaseAdmin
            .from('orcamentos')
            .select('id,numero,wvetro_fluxo,modo_entrada')
            .eq('empresa_id', usuario.empresa_id)
            .in('modo_entrada', ['wvetro_api', 'wvetro_api_vinculado'])
        : { data: [] as any[] }

      const localPorNumero = new Map<string, any>()
      for (const o of locais || []) {
        const n = txt(obj(o.wvetro_fluxo).numero)
        if (n && numeros.includes(n) && o.modo_entrada !== 'wvetro_api_vinculado') localPorNumero.set(n, o)
      }

      const candidatos = candidatosBase.map(c => ({
        ...c,
        nome_exato: norm(c.cliente) === norm(alvo.cliente_nome),
        atlas_id: localPorNumero.get(c.numero)?.id || null,
        atlas_numero: localPorNumero.get(c.numero)?.numero || null,
      }))

      return NextResponse.json({
        ok: true,
        cliente: alvo.cliente_nome,
        inicio: recentes.inicio,
        fim: recentes.fim,
        candidatos,
        autoVincularNumero: candidatosBase.length === 1 ? candidatosBase[0].numero : null,
        mensagem: candidatosBase.length
          ? `${candidatosBase.length} orçamento(s) do W.Vetro encontrado(s) com nome compatível com este cliente.`
          : 'Nenhum orçamento W.Vetro com nome compatível foi encontrado nos últimos 7 dias.',
      })
    }

    if (acao === 'vincular') {
      const numeroWvetro = txt(body.numeroWvetro)
      if (!numeroWvetro) return NextResponse.json({ error: 'Escolha o orçamento W.Vetro.' }, { status: 400 })

      const recentes = await listarRecentes(alvo.cliente_nome)
      const candidato = recentes.todos.find(c => c.numero === numeroWvetro)
      if (!candidato) return NextResponse.json({ error: 'O orçamento escolhido não apareceu no W.Vetro nos últimos 7 dias. Sincronize novamente ou confira o período.' }, { status: 404 })
      if (!nomesClientesCompativeis(candidato.cliente, alvo.cliente_nome)) {
        return NextResponse.json({
          error: `O W.Vetro #${numeroWvetro} pertence a "${candidato.cliente}" e não pode ser vinculado ao cliente "${alvo.cliente_nome}".`,
        }, { status: 409 })
      }

      const { data: existentes } = await supabaseAdmin
        .from('orcamentos')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .contains('wvetro_fluxo', { numero: numeroWvetro })

      const ativoExistente = (existentes || []).find((o: any) => o.id !== alvo.id && o.modo_entrada !== 'wvetro_api_vinculado') || null

      // Se ainda não existe outro orçamento Atlas para este número, pré-vincula o próprio card.
      // Assim a sincronização atualiza ESTE registro e não cria um card duplicado.
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
      const atualizado = fonteAtual
        ? await mesclarFonteNoCard(usuario.empresa_id, alvoAtual, fonteAtual, usuario)
        : alvoAtual

      await inserirHistorico(
        alvo.id,
        usuario,
        'Sincronizou orçamento do W.Vetro',
        `W.Vetro #${numeroWvetro} vinculado ao card. Dados manuais e anexos existentes foram preservados.`,
      )

      return NextResponse.json({
        ok: true,
        orcamento: atualizado,
        numeroWvetro,
        ocultadoId: fonteAtual?.id || null,
        mensagem: `Orçamento W.Vetro #${numeroWvetro} sincronizado neste card sem apagar anexos ou dados manuais.`,
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
