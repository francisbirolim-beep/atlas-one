import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

function digitos(valor: unknown) {
  return String(valor ?? '').replace(/\D/g, '')
}

async function carregarCliente(id: string, empresaId: string) {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id,nome,apelido,cpf_cnpj,whatsapp,telefone,email,cidade,bairro,endereco,origem,created_at')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolverPendencia(id: string, empresaId: string, usuario: { id: string; nome: string }, status: 'resolvida' | 'ignorada') {
  const { data, error } = await supabaseAdmin
    .from('cadastro_pendencias')
    .update({
      status,
      atualizado_em: new Date().toISOString(),
      resolvido_em: new Date().toISOString(),
      resolvido_por_id: usuario.id,
      resolvido_por_nome: usuario.nome,
    })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select('id,status')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Pendência não encontrada.')
  return data
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const modo = String(req.nextUrl.searchParams.get('modo') || '').trim()

    if (modo === 'clientes') {
      const busca = String(req.nextUrl.searchParams.get('busca') || '').trim()
      if (busca.length < 2) return NextResponse.json({ ok: true, clientes: [] })

      const { data, error } = await supabaseAdmin
        .from('clientes')
        .select('id,nome,apelido,cpf_cnpj,whatsapp,telefone,email,cidade,bairro')
        .eq('empresa_id', usuario.empresa_id)
        .order('nome')
        .limit(1500)

      if (error) throw error
      const alvo = normalizar(busca)
      const alvoDigitos = digitos(busca)

      const clientes = (data || [])
        .map((cliente: any) => {
          const texto = normalizar([
            cliente.nome,
            cliente.apelido,
            cliente.cpf_cnpj,
            cliente.whatsapp,
            cliente.telefone,
            cliente.email,
            cliente.cidade,
            cliente.bairro,
          ].filter(Boolean).join(' '))
          const numeros = [cliente.cpf_cnpj, cliente.whatsapp, cliente.telefone].map(digitos).join(' ')
          const nome = normalizar(cliente.nome)
          let score = 0
          if (nome === alvo) score += 100
          else if (nome.startsWith(alvo)) score += 70
          else if (nome.includes(alvo)) score += 50
          if (texto.includes(alvo)) score += 20
          if (alvoDigitos.length >= 4 && numeros.includes(alvoDigitos)) score += 80
          return { ...cliente, score }
        })
        .filter((cliente: any) => cliente.score > 0)
        .sort((a: any, b: any) => b.score - a.score || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        .slice(0, 30)
        .map(({ score, ...cliente }: any) => cliente)

      return NextResponse.json({ ok: true, clientes })
    }

    const status = String(req.nextUrl.searchParams.get('status') || 'abertas').trim()
    let query = supabaseAdmin
      .from('cadastro_pendencias')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .order('criado_em', { ascending: false })
      .limit(500)

    if (status === 'abertas') query = query.in('status', ['pendente', 'em_analise'])
    else if (status !== 'todas') query = query.eq('status', status)

    const [{ data: pendencias, error }, { data: resumoRows, error: erroResumo }] = await Promise.all([
      query,
      supabaseAdmin
        .from('cadastro_pendencias')
        .select('tipo,status')
        .eq('empresa_id', usuario.empresa_id)
        .in('status', ['pendente', 'em_analise']),
    ])
    if (error) throw error
    if (erroResumo) throw erroResumo

    const ids = Array.from(new Set(
      (pendencias || [])
        .flatMap((item: any) => [item.cliente_id, item.cliente_candidato_id])
        .filter(Boolean),
    ))

    const clientes = new Map<string, any>()
    if (ids.length > 0) {
      const { data: dadosClientes, error: erroClientes } = await supabaseAdmin
        .from('clientes')
        .select('id,nome,apelido,cpf_cnpj,whatsapp,telefone,email,cidade,bairro,endereco,origem,created_at')
        .eq('empresa_id', usuario.empresa_id)
        .in('id', ids)
      if (erroClientes) throw erroClientes
      for (const cliente of dadosClientes || []) clientes.set(String(cliente.id), cliente)
    }

    const resumo = {
      total: (resumoRows || []).length,
      cadastro_incompleto: 0,
      possivel_duplicidade: 0,
      vinculo_wvetro: 0,
    }
    for (const item of resumoRows || []) {
      if (item.tipo === 'cadastro_incompleto') resumo.cadastro_incompleto += 1
      if (item.tipo === 'possivel_duplicidade') resumo.possivel_duplicidade += 1
      if (item.tipo === 'vinculo_wvetro') resumo.vinculo_wvetro += 1
    }

    return NextResponse.json({
      ok: true,
      resumo,
      pendencias: (pendencias || []).map((item: any) => ({
        ...item,
        cliente: item.cliente_id ? clientes.get(String(item.cliente_id)) || null : null,
        clienteCandidato: item.cliente_candidato_id ? clientes.get(String(item.cliente_candidato_id)) || null : null,
      })),
    })
  } catch (e) {
    console.error('Erro ao carregar pendências de cadastro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao carregar pendências.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as Record<string, any>
    const acao = String(body.acao || '').trim()
    const pendenciaId = String(body.pendenciaId || '').trim()

    if (!pendenciaId) return NextResponse.json({ error: 'Pendência não informada.' }, { status: 400 })

    const { data: pendencia, error: erroPendencia } = await supabaseAdmin
      .from('cadastro_pendencias')
      .select('*')
      .eq('id', pendenciaId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (erroPendencia) throw erroPendencia
    if (!pendencia) return NextResponse.json({ error: 'Pendência não encontrada.' }, { status: 404 })

    if (acao === 'assumir') {
      const dados = pendencia.dados && typeof pendencia.dados === 'object' ? pendencia.dados : {}
      const { error } = await supabaseAdmin
        .from('cadastro_pendencias')
        .update({
          status: 'em_analise',
          dados: { ...dados, analisando_por_id: usuario.id, analisando_por_nome: usuario.nome },
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pendencia.id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (acao === 'resolver') {
      await resolverPendencia(pendencia.id, usuario.empresa_id, usuario, 'resolvida')
      return NextResponse.json({ ok: true })
    }

    if (acao === 'ignorar') {
      await resolverPendencia(pendencia.id, usuario.empresa_id, usuario, 'ignorada')
      return NextResponse.json({ ok: true })
    }

    if (acao === 'mesclar') {
      const origemId = String(body.origemClienteId || pendencia.cliente_id || '').trim()
      const destinoId = String(body.destinoClienteId || '').trim()
      if (!origemId || !destinoId || origemId === destinoId) {
        return NextResponse.json({ error: 'Selecione outro cadastro como destino da mesclagem.' }, { status: 400 })
      }

      const [origem, destino] = await Promise.all([
        carregarCliente(origemId, usuario.empresa_id),
        carregarCliente(destinoId, usuario.empresa_id),
      ])
      if (!origem || !destino) return NextResponse.json({ error: 'Um dos clientes não pertence à empresa ou não existe.' }, { status: 404 })

      const { data, error } = await supabaseAdmin.rpc('mesclar_clientes', {
        p_origem: origemId,
        p_destino: destinoId,
        p_usuario_id: usuario.id,
        p_usuario_nome: usuario.nome,
      })
      if (error) throw error

      await resolverPendencia(pendencia.id, usuario.empresa_id, usuario, 'resolvida').catch(() => null)
      return NextResponse.json({ ok: true, resultado: data, clienteDestino: destino })
    }

    if (acao === 'vincular_wvetro') {
      const destinoId = String(body.destinoClienteId || '').trim()
      if (!destinoId) return NextResponse.json({ error: 'Selecione o cliente do Atlas.' }, { status: 400 })

      const destino = await carregarCliente(destinoId, usuario.empresa_id)
      if (!destino) return NextResponse.json({ error: 'Cliente de destino não encontrado.' }, { status: 404 })

      const dados = pendencia.dados && typeof pendencia.dados === 'object' ? pendencia.dados as Record<string, any> : {}
      const numeroWvetro = String(dados.numero_wvetro || '').trim()
      if (!numeroWvetro) return NextResponse.json({ error: 'A pendência não possui o número do orçamento W.Vetro.' }, { status: 409 })

      const { data: orcamentos, error: erroOrcamentos } = await supabaseAdmin
        .from('orcamentos')
        .select('id,wvetro_fluxo')
        .eq('empresa_id', usuario.empresa_id)
        .contains('wvetro_fluxo', { numero: numeroWvetro })
      if (erroOrcamentos) throw erroOrcamentos
      if (!orcamentos?.length) return NextResponse.json({ error: 'Nenhum orçamento W.Vetro correspondente foi encontrado.' }, { status: 404 })

      const { error: erroVinculo } = await supabaseAdmin
        .from('orcamentos')
        .update({
          cliente_id: destino.id,
          cliente_nome: destino.nome,
          cliente_whatsapp: destino.whatsapp || destino.telefone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('empresa_id', usuario.empresa_id)
        .in('id', orcamentos.map((item: any) => item.id))
      if (erroVinculo) throw erroVinculo

      await resolverPendencia(pendencia.id, usuario.empresa_id, usuario, 'resolvida')
      return NextResponse.json({ ok: true, vinculados: orcamentos.length, clienteDestino: destino })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro ao tratar pendência de cadastro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao tratar pendência.' }, { status: 500 })
  }
}
