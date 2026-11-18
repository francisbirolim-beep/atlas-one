import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const competenciaValida = /^\d{4}-(0[1-9]|1[0-2])$/
const texto = (v: unknown, max = 150) => String(v ?? '').trim().slice(0, max)
const erro = (mensagem: string, status = 400) => NextResponse.json({ error: mensagem }, { status })
const preview = () => process.env.VERCEL_ENV === 'preview'
const campos = {
 empresa_codigo: 20, empresa_nome: 200, empresa_endereco: 250, empresa_cnpj: 30,
 titulo: 100, tipo_pagamento: 100, data_pagamento: 10,
 funcionario_codigo: 30, pis: 30, cbo: 20, folha: 10,
 local_codigo: 30, local_nome: 110, data_admissao: 10, cargo_codigo: 30,
 cargo: 120, banco: 120, agencia: 50, conta: 70,
 salario_base: 30, salario_contrib_inss: 30, base_fgts: 30,
 fgts_mes: 30, base_irrf: 30, observacoes: 600, rodape: 250,
} as const
const valorEmCentavos = (v: unknown): number | null => {
 const n = Number(v)
 if (v === '' || v == null || !Number.isFinite(n) || n < 0 || n > 100000000 || Math.abs(n * 100 - Math.round(n * 100)) > .001) return null
 return Math.round(n * 100)
}
function dataValida(v: string) {
 if (!v) return true
 if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
 const d = new Date(v + 'T12:00:00Z')
 return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
async function auth(req: NextRequest) {
 const usuario = await autenticarCompras(req)
 if (!usuario) return { error: erro('Sessão inválida.', 401) }
 if (usuario.role !== 'master') return { error: erro('Recibos do RH restritos ao Master.', 403) }
 return { usuario }
}
function validar(body: any) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Dados inválidos.' }
 const competencia = texto(body.competencia, 7)
 if (!competenciaValida.test(competencia)) return { error: 'Competência inválida.' }
 const nome = texto(body.funcionario_nome, 170)
 if (nome.length < 3) return { error: 'Informe nome do funcionário com pelo menos três caracteres.' }
 const rhPessoaId = texto(body.rh_pessoa_id, 60)
 if (rhPessoaId && !uuid.test(rhPessoaId)) return { error: 'Funcionário do RH inválido.' }
 const d: Record<string, string> = {}
 for (const [key, limite] of Object.entries(campos)) d[key] = texto(body.dados?.[key], limite)
 if (!dataValida(d.data_pagamento) || !dataValida(d.data_admissao)) return { error: 'Data de pagamento/admissão inválida.' }
 if (d.salario_base && (valorEmCentavos(d.salario_base) === null)) return { error: 'Salário-base inválido.' }
 if (!Array.isArray(body.dados?.itens) || !body.dados.itens.length || body.dados.itens.length > 30) {
  return { error: 'Informe de 1 a 30 lançamentos no recibo.' }
 }
 let vencimentos = 0, descontos = 0
 const itens: Array<Record<string, string | number>> = []
 for (const row of body.dados.itens) {
  if (!row || typeof row !== 'object') return { error: 'Linha de lançamento inválida.' }
  const descricao = texto(row.descricao, 130), venc = valorEmCentavos(row.vencimentos), desc = valorEmCentavos(row.descontos)
  if (!descricao || venc == null || desc == null) return { error: 'Cada linha exige descrição e valores válidos.' }
  if (venc && desc) return { error: 'Separe vencimentos e descontos em linhas diferentes.' }
  vencimentos += venc; descontos += desc
  itens.push({
   dia: texto(row.dia, 4), codigo: texto(row.codigo, 20), descricao,
   quantidade: texto(row.quantidade, 30), referencia: texto(row.referencia, 40),
   base: texto(row.base, 30), vencimentos: venc / 100, descontos: desc / 100,
  })
 }
 if (descontos > vencimentos) return { error: 'Os descontos não podem ultrapassar os vencimentos.' }
 const situacao = texto(body.situacao, 12)
 if (!['rascunho','emitido'].includes(situacao)) return { error: 'Situação inválida.' }
 if (situacao === 'emitido' && (!body.conferido || vencimentos === 0)) return { error: 'Confira o documento e confirme a emissão.' }
 return {
  payload: {
   rh_pessoa_id: rhPessoaId || null, funcionario_nome: nome, competencia,
   dados: { ...d, itens },
   total_vencimentos: vencimentos / 100, total_descontos: descontos / 100,
   valor_liquido: (vencimentos - descontos) / 100, situacao,
  },
 }
}
export async function GET(req: NextRequest) {
 const acesso = await auth(req); if (acesso.error) return acesso.error
 const u = acesso.usuario!
 try {
  const [pessoas, recibos] = await Promise.all([
   supabaseAdmin.from('rh_pessoas')
    .select('id,nome,cargo,setor,data_admissao,salario_base,ativo')
    .eq('empresa_id', u.empresa_id).eq('tipo','funcionario').order('nome').limit(1500),
   supabaseAdmin.from('rh_adiantamentos')
    .select('id,rh_pessoa_id,funcionario_nome,competencia,dados,total_vencimentos,total_descontos,valor_liquido,situacao,created_at,emitido_em')
    .eq('empresa_id', u.empresa_id).order('created_at', { ascending: false }).limit(500),
  ])
  if (pessoas.error) throw pessoas.error
  if (recibos.error) {
   if (preview() && ['42P01','PGRST205','42703'].includes(recibos.error.code || '')) {
    return NextResponse.json({ ok: true, pessoas: pessoas.data || [], recibos: [], simulacao: true },
     { headers: { 'Cache-Control': 'private, no-store' } })
   }
   throw recibos.error
  }
  return NextResponse.json({ ok: true, pessoas: pessoas.data || [], recibos: recibos.data || [] },
   { headers: { 'Cache-Control': 'private, no-store' } })
 } catch (e) {
  console.error('RH adiantamentos GET', e)
  return erro('Não foi possível carregar recibos de adiantamento.', 500)
 }
}
export async function POST(req: NextRequest) {
 const acesso = await auth(req); if (acesso.error) return acesso.error
 if (preview()) return erro('Ambiente de prévia: gravação desabilitada.', 423)
 const u = acesso.usuario!
 try {
  const b = await req.json(), validado = validar(b)
  if ('error' in validado) return erro(validado.error!)
  const payload = validado.payload!
  if (payload.rh_pessoa_id) {
   const { data: pessoa, error } = await supabaseAdmin.from('rh_pessoas').select('id')
    .eq('empresa_id',u.empresa_id).eq('id',payload.rh_pessoa_id).eq('tipo','funcionario').eq('ativo',true).maybeSingle()
   if (error) throw error
   if (!pessoa) return erro('Funcionário não encontrado nesta empresa ou inativo.', 404)
  }
  const { data, error } = await supabaseAdmin.from('rh_adiantamentos').insert({
   ...payload, empresa_id: u.empresa_id, criado_por_id: u.id, criado_por_nome: u.nome,
   emitido_em: payload.situacao === 'emitido' ? new Date().toISOString() : null,
  }).select('id').single()
  if (error) throw error
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
 } catch (e) {
  console.error('RH adiantamentos POST', e)
  return erro('Falha ao salvar recibo.', 500)
 }
}
export async function PATCH(req: NextRequest) {
 const acesso = await auth(req); if (acesso.error) return acesso.error
 if (preview()) return erro('Ambiente de prévia: gravação desabilitada.', 423)
 const u = acesso.usuario!
 try {
  const b = await req.json(), id = texto(b.id, 60)
  if (!uuid.test(id)) return erro('Identificação inválida.')
  const { data: existente, error: exErr } = await supabaseAdmin.from('rh_adiantamentos')
   .select('id,situacao').eq('empresa_id', u.empresa_id).eq('id', id).maybeSingle()
  if (exErr) throw exErr
  if (!existente) return erro('Recibo não encontrado.', 404)
  if (existente.situacao === 'emitido') return erro('Recibo emitido não pode ser alterado. Duplique para emitir uma nova versão.', 409)
  const validado = validar(b)
  if ('error' in validado) return erro(validado.error!)
  const payload = validado.payload!
  if (payload.rh_pessoa_id) {
   const { data: pessoa, error } = await supabaseAdmin.from('rh_pessoas').select('id')
    .eq('empresa_id', u.empresa_id).eq('id', payload.rh_pessoa_id).eq('tipo','funcionario').eq('ativo',true).maybeSingle()
   if (error) throw error
   if (!pessoa) return erro('Funcionário inválido ou inativo.',404)
  }
  const { data, error } = await supabaseAdmin.from('rh_adiantamentos').update({
   ...payload, updated_at: new Date().toISOString(),
   emitido_em: payload.situacao === 'emitido' ? new Date().toISOString() : null,
  }).eq('empresa_id', u.empresa_id).eq('id', id).eq('situacao','rascunho').select('id').maybeSingle()
  if (error) throw error
  if (!data) return erro('O recibo foi alterado por outra operação; atualize a lista.',409)
  return NextResponse.json({ ok: true, id: data.id })
 } catch (e) {
  console.error('RH adiantamentos PATCH', e)
  return erro('Falha ao atualizar recibo.', 500)
 }
}
