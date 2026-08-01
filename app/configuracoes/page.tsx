'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus, Users, Clock, ShieldAlert, ChevronDown, ChevronUp, LayoutGrid, Target, Save, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunas, atualizarSlaColuna, atualizarCoresColuna } from '@/lib/kanban'
import { listarSetores, listarPermissoesUsuario, salvarPermissoesUsuario, agruparSetores, GRUPOS_ORDEM, atualizarSetor } from '@/lib/setores'
import { mesAtual, listarMetas, salvarMeta } from '@/lib/crm'
import { listarBackups, criarBackupAgora, restaurarBackup, RegistroBackup } from '@/lib/backup'
import { Usuario, KanbanColuna, Setor, NivelPermissao, Meta } from '@/lib/tipos'

const nivelLabel: Record<NivelPermissao, string> = {
      oculto: 'Oculto',
      consulta: 'Só consulta',
      edicao: 'Consulta e edição',
}

export default function Configuracoes() {
      const [carregando, setCarregando] = useState(true)
      const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
      const [usuarios, setUsuarios] = useState<Usuario[]>([])
            const [colunas, setColunas] = useState<KanbanColuna[]>([])
            const [slaEdit, setSlaEdit] = useState<Record<string, { amarelo: string; vermelho: string }>>({})
  const [corEdit, setCorEdit] = useState<Record<string, { ativa: boolean; corCards: string; amareloCor: string; vermelhoCor: string }>>({})

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [whatsappNovo, setWhatsappNovo] = useState('')
  const [role, setRole] = useState<'funcionario' | 'master'>('funcionario')
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [sucessoUsuario, setSucessoUsuario] = useState('')
  const [whatsappEdit, setWhatsappEdit] = useState<Record<string, string>>({})
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState<string | null>(null)

  const [metas, setMetas] = useState<Record<string, { valor: string; quantidade: string }>>({})
  const [salvandoMeta, setSalvandoMeta] = useState<string | null>(null)
  const mesMetaAtual = mesAtual()

  const [setores, setSetores] = useState<Setor[]>([])
        const [permissoesExpandido, setPermissoesExpandido] = useState<string | null>(null)
  const [permissoesPorUsuario, setPermissoesPorUsuario] = useState<Record<string, Record<string, NivelPermissao>>>({})
  const [salvandoPermissoes, setSalvandoPermissoes] = useState<string | null>(null)
  const [permissoesCarregando, setPermissoesCarregando] = useState<string | null>(null)

  const [backups, setBackups] = useState<RegistroBackup[]>([])
        const [fazendoBackup, setFazendoBackup] = useState(false)
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null)
  const [msgBackup, setMsgBackup] = useState('')

  const [setoresEdit, setSetoresEdit] = useState<Record<string, { nome: string; grupo: string; ordem: string; descricao: string }>>({})
  const [salvandoSetor, setSalvandoSetor] = useState<string | null>(null)

  useEffect(() => {
                carregar()
  }, [])

  async function carregar() {
          setCarregando(true)
          const me = await usuarioAtual()
          setEuSouMaster(me?.role === 'master')

    if (me?.role === 'master') {
              const [{ data: users }, cols, listaSetores, listaMetas, listaBackups] = await Promise.all([
                          supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
                          listarColunas(),
              listarSetores(),
                          listarMetas(mesMetaAtual),
                          listarBackups(),
                        ])
              setBackups(listaBackups)
              setSetores(listaSetores)
              const setoresIniciais: Record<string, { nome: string; grupo: string; ordem: string; descricao: string }> = {}
              listaSetores.forEach(s => {
                          setoresIniciais[s.id] = { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
              })
      setSetoresEdit(setoresIniciais)
            const listaUsuarios = (users as Usuario[]) || []
                      setUsuarios(listaUsuarios)

      const metasIniciais: Record<string, { valor: string; quantidade: string }> = {}
      listaMetas.forEach((m: Meta) => {
                                 const chave = m.usuario_id || 'geral'
        metasIniciais[chave] = {
                    valor: m.meta_valor != null ? String(m.meta_valor) : '',
                    quantidade: m.meta_quantidade != null ? String(m.meta_quantidade) : '',
                                 }
      })
      setMetas(metasIniciais)
                const whatsInicial: Record<string, string> = {}
      listaUsuarios.forEach(u => { whatsInicial[u.id] = u.whatsapp || '' })
      setWhatsappEdit(whatsInicial)
                setColunas(cols)
                const inicial: Record<string, { amarelo: string; vermelho: string }> = {}
      const coresIniciais: Record<string, { ativa: boolean; corCards: string; amareloCor: string; vermelhoCor: string }> = {}
                cols.forEach(c => {
                  inicial[c.id] = {
                                amarelo: c.sla_amarelo_horas != null ? String(c.sla_amarelo_horas) : '',
                                vermelho: c.sla_vermelho_horas != null ? String(c.sla_vermelho_horas) : '',
                  }
                  coresIniciais[c.id] = {
                                ativa: !!c.cor_cards,
                                corCards: c.cor_cards || '#3b82f6',
                                amareloCor: c.sla_amarelo_cor || '#f59e0b',
                                vermelhoCor: c.sla_vermelho_cor || '#ef4444',
                  }
      })
      setSlaEdit(inicial)
      setCorEdit(coresIniciais)
}
    setCarregando(false)
}

  async function cadastrarUsuario(e: React.FormEvent) {
          e.preventDefault()
          setErroUsuario('')
          setSucessoUsuario('')
          if (!nome.trim() || !email.trim() || !senha.trim()) {
                    setErroUsuario('Preencha nome, e-mail e senha')
                    return
          }
          setSalvandoUsuario(true)
          const token = await tokenAtual()
          const resp = await fetch('/api/criar-usuario', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ nome, email, senha, role, whatsapp: whatsappNovo }),
          })
          const json = await resp.json()
          setSalvandoUsuario(false)
          if (!resp.ok) {
                    setErroUsuario(json.error || 'Erro ao cadastrar usuário')
                    return
          }
          setSucessoUsuario(`Usuário ${nome} cadastrado com sucesso.`)
          setNome('')
          setEmail('')
          setSenha('')
          setWhatsappNovo('')
          setRole('funcionario')
          carregar()
  }

  async function salvarWhatsappUsuario(id: string) {
          setSalvandoWhatsapp(id)
          const token = await tokenAtual()
          const whatsapp = whatsappEdit[id] || ''

    const resp = await fetch('/api/atualizar-usuario', {
                    method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ id, whatsapp }),
    })
          setSalvandoWhatsapp(null)
          if (resp.ok) {
                    setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, whatsapp: whatsapp || null } : u)))
          }
  }

  async function alternarPermissoes(usuarioId: string) {
          if (permissoesExpandido === usuarioId) {
                    setPermissoesExpandido(null)
                    return
          }
          setPermissoesExpandido(usuarioId)
          if (!permissoesPorUsuario[usuarioId]) {
                    setPermissoesCarregando(usuarioId)
                    const mapa = await listarPermissoesUsuario(usuarioId)
                    setPermissoesPorUsuario(prev => ({ ...prev, [usuarioId]: mapa }))
                    setPermissoesCarregando(null)
          }
  }

  function mudarNivel(usuarioId: string, setorId: string, nivel: NivelPermissao) {
          setPermissoesPorUsuario(prev => ({
                    ...prev,
                    [usuarioId]: { ...(prev[usuarioId] || {}), [setorId]: nivel },
          }))
  }

  async function salvarPermissoes(usuarioId: string) {
          setSalvandoPermissoes(usuarioId)
          await salvarPermissoesUsuario(usuarioId, permissoesPorUsuario[usuarioId] || {})
          setSalvandoPermissoes(null)
  }

  async function salvarMetaUsuario(usuarioId: string | null, usuarioNome: string | null) {
          const chave = usuarioId || 'geral'
          setSalvandoMeta(chave)
          const valores = metas[chave] || { valor: '', quantidade: '' }
          const metaValor = valores.valor.trim() ? parseFloat(valores.valor) : null
          const metaQuantidade = valores.quantidade.trim() ? parseInt(valores.quantidade) : null
          await salvarMeta(mesMetaAtual, usuarioId, usuarioNome, metaValor, metaQuantidade)
          setSalvandoMeta(null)
  }

  async function fazerBackupAgora() {
          setFazendoBackup(true)
          setMsgBackup('')
          try {
                    const token = await tokenAtual()
                    if (!token) throw new Error('Sessão expirada')
                    await criarBackupAgora(token)
                    setMsgBackup('Backup criado com sucesso.')
                    setBackups(await listarBackups())
          } catch (e: any) {
                    setMsgBackup(e?.message || 'Erro ao criar backup')
          }
          setFazendoBackup(false)
  }

  async function restaurarBackupComConfirmacao(backup: RegistroBackup) {
          const dataFormatada = new Date(backup.created_at).toLocaleString('pt-BR')
          const confirmar = window.confirm(
                    `Restaurar o backup de ${dataFormatada}?\n\nIsso vai APAGAR os dados atuais (clientes, orçamentos, kanban, usuários, CRM, assistências) e substituir por esse backup. Um backup de segurança do estado atual será criado automaticamente antes, então dá pra desfazer se precisar.\n\nTem certeza que quer continuar?`
                  )
          if (!confirmar) return

    setRestaurandoId(backup.id)
          setMsgBackup('')
          try {
                    const token = await tokenAtual()
                    if (!token) throw new Error('Sessão expirada')
                    await restaurarBackup(token, backup.id)
                    setMsgBackup('Backup restaurado com sucesso. Recarregando...')
                    setTimeout(() => window.location.reload(), 1200)
          } catch (e: any) {
                    setMsgBackup(e?.message || 'Erro ao restaurar backup')
                    setRestaurandoId(null)
          }
  }

  async function salvarSetor(id: string) {
          const dados = setoresEdit[id]
          if (!dados) return
          setSalvandoSetor(id)
          await atualizarSetor(id, {
                    nome: dados.nome.trim(),
                    grupo: dados.grupo,
                    ordem: dados.ordem.trim() ? parseInt(dados.ordem) : 0,
                    descricao: dados.descricao.trim() || null,
          })
          setSetores(await listarSetores())
          setSalvandoSetor(null)
  }

  async function salvarSla(colunaId: string) {
          const valores = slaEdit[colunaId]
          const amarelo = valores.amarelo.trim() ? parseInt(valores.amarelo) : null
          const vermelho = valores.vermelho.trim() ? parseInt(valores.vermelho) : null
          const cores = corEdit[colunaId]
          const corCards = cores?.ativa ? cores.corCards : null

    await Promise.all([
              atualizarSlaColuna(colunaId, amarelo, vermelho),
              atualizarCoresColuna(colunaId, corCards, cores?.amareloCor || '#f59e0b', cores?.vermelhoCor || '#ef4444'),
            ])

    setColunas(prev =>
                     prev.map(c =>
                                      c.id === colunaId
                ? {
                                  ...c,
                                  sla_amarelo_horas: amarelo,
                                  sla_vermelho_horas: vermelho,
                                  cor_cards: corCards,
                                  sla_amarelo_cor: cores?.amareloCor || '#f59e0b',
                                  sla_vermelho_cor: cores?.vermelhoCor || '#ef4444',
                }
                  : c
            )
    )
  }

  if (carregando) {
          return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
          return (
                    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
                      <ShieldAlert size={40} className="text-slate-300" />
              <p className="text-slate-500">Só o usuário master pode acessar as Configurações.</p>
              <Link href="/" className="text-brand-navy text-sm hover:underline">Voltar ao início</Link>
            </div>
          )
  }

  return (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
{/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>

            <h1 className="text-lg font-bold text-slate-800">Configurações</h1>
                  <p className="text-sm text-slate-500">Usuários e tempos de alerta do painel</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <Users size={16} /> Usuários cadastrados
          </h2>
          <div className="space-y-2 mb-6">
{usuarios.map(u => (
                  <div key={u.id} className="border border-slate-100 rounded-lg px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                   <div>
                     <p className="text-slate-800 font-medium">{u.nome}</p>
                     <p className="text-slate-400 text-xs">{u.email}</p>
                   </div>
                   <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'master' ? 'bg-brand-navyLight text-brand-navyDark' : 'bg-slate-100 text-slate-600'}`}>
{u.role === 'master' ? 'Master' : 'Funcionário'}
                                         </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={whatsappEdit[u.id] ?? ''}
                    onChange={e => setWhatsappEdit(prev => ({ ...prev, [u.id]: e.target.value }))}
                                            placeholder="WhatsApp (ex: 11999998888)"
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => salvarWhatsappUsuario(u.id)}
                    disabled={salvandoWhatsapp === u.id}
                                            className="px-2.5 py-1.5 bg-brand-navyLight text-brand-navyDark rounded-lg text-xs font-medium hover:bg-brand-navy hover:text-white transition disabled:opacity-50"
                  >
{salvandoWhatsapp === u.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>

{u.role !== 'master' && (
                      <div>
                        <button
                       onClick={() => alternarPermissoes(u.id)}
                      className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                    >
                      <LayoutGrid size={13} />
                      Permissões por setor
{permissoesExpandido === u.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

{permissoesExpandido === u.id && (
                          <div className="mt-2 border border-slate-100 rounded-lg p-3 space-y-4">
 {permissoesCarregando === u.id ? (
                               <p className="text-xs text-slate-400">Carregando permissões...</p>
                             ) : (
                                                           <>
                                 {GRUPOS_ORDEM.map(grupo => {
                                   const itens = agruparSetores(setores)[grupo] || []
                                                                     if (itens.length === 0) return null
                                   return (
                                                                       <div key={grupo}>
                                                                         <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{grupo}</p>
                                       <div className="space-y-1.5">
     {itens.map(setor => {
                                               const nivelAtual = permissoesPorUsuario[u.id]?.[setor.id] || 'oculto'
                                               return (
                                                                                           <div key={setor.id} className="flex items-center justify-between gap-2">
                                                                                             <span className="text-xs text-slate-600 flex-1">{setor.nome}</span>
                                                   <select
                                                     value={nivelAtual}
                                                     onChange={e => mudarNivel(u.id, setor.id, e.target.value as NivelPermissao)}
                                                                                                     className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                                                   >
                                                     <option value="oculto">{nivelLabel.oculto}</option>
                                                     <option value="consulta">{nivelLabel.consulta}</option>
                                                     <option value="edicao">{nivelLabel.edicao}</option>
                                                   </select>
                                                 </div>
                                               )
     })}
                                       </div>
                                     </div>
                                   )
 })}
                              <button
                                onClick={() => salvarPermissoes(u.id)}
                               disabled={salvandoPermissoes === u.id}
                                                                 className="w-full py-2 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                             >
 {salvandoPermissoes === u.id ? 'Salvando...' : 'Salvar permissões'}
                             </button>
                           </>
                         )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <UserPlus size={16} /> Cadastrar novo usuário
          </h3>
          <form onSubmit={cadastrarUsuario} className="space-y-3">
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
                                placeholder="Nome do funcionário"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
                                placeholder="E-mail de acesso"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <input
              type="text"
              value={senha}
              onChange={e => setSenha(e.target.value)}
                                placeholder="Senha (mínimo 6 caracteres)"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <input
              type="text"
              value={whatsappNovo}
              onChange={e => setWhatsappNovo(e.target.value)}
                                placeholder="WhatsApp (ex: 11999998888) — opcional"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'funcionario' | 'master')}
                                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            >
              <option value="funcionario">Funcionário</option>
              <option value="master">Master (acesso total)</option>
            </select>

{erroUsuario && <p className="text-red-500 text-sm">{erroUsuario}</p>}
{sucessoUsuario && <p className="text-brand-teal text-sm">{sucessoUsuario}</p>}

            <button
              type="submit"
              disabled={salvandoUsuario}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"

            >
              {salvandoUsuario ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Clock size={16} /> Alertas e cores por coluna do painel
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Defina depois de quantas horas parado o card fica amarelo (atenção) e depois de quantas horas fica vermelho (atrasado) — o card inteiro fica pintado com a cor escolhida. Também dá pra escolher uma cor automática pros cards que estiverem nessa coluna (ex: verde quando o orçamento é feito).
                          </p>
          <div className="space-y-3">
{colunas.map(col => (
                  <div key={col.id} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">{col.nome}</p>
                 <div className="grid grid-cols-2 gap-3 mb-3">
                   <div>
                     <label className="block text-xs text-slate-500 mb-1">Amarelo após (horas)</label>
                     <input
                       type="number"
                       value={slaEdit[col.id]?.amarelo ?? ''}
                      onChange={e =>
                                                        setSlaEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], amarelo: e.target.value } }))
                               }
                                                placeholder="Ex: 12"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Vermelho após (horas)</label>
                    <input
                      type="number"
                      value={slaEdit[col.id]?.vermelho ?? ''}
                      onChange={e =>
                                                        setSlaEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], vermelho: e.target.value } }))
                               }
                                                placeholder="Ex: 24"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cor do alerta amarelo</label>
                                            <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={corEdit[col.id]?.amareloCor || '#f59e0b'}
                        onChange={e =>
                                                            setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], amareloCor: e.target.value } }))
                                 }
                                                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.amareloCor || '#f59e0b'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cor do alerta vermelho</label>
                                            <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={corEdit[col.id]?.vermelhoCor || '#ef4444'}
                        onChange={e =>
                                                            setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], vermelhoCor: e.target.value } }))
                                 }
                                                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.vermelhoCor || '#ef4444'}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    <input
                      type="checkbox"
                      checked={corEdit[col.id]?.ativa || false}
                      onChange={e =>
                                                        setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], ativa: e.target.checked } }))
                               }
                                              />
                    Pintar automaticamente os cards que caírem nessa coluna
                  </label>
{corEdit[col.id]?.ativa && (
                        <div className="flex items-center gap-2">
                          <input
                         type="color"
                         value={corEdit[col.id]?.corCards || '#3b82f6'}
                        onChange={e =>
                                                            setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], corCards: e.target.value } }))
                                 }
                                                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.corCards || '#3b82f6'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => salvarSla(col.id)}
                  className="text-xs text-brand-navy hover:underline"
                >
                  Salvar configurações dessa coluna
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Target size={16} /> Metas comerciais do mês
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Meta de {new Date(mesMetaAtual + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Vale como valor fechado (aprovado/convertido) e/ou quantidade de negócios fechados no mês. Aparece como progresso no CRM.
                          </p>
          <div className="space-y-2">
            <div className="border border-slate-100 rounded-xl p-3">
              <p className="text-sm font-medium text-slate-700 mb-2">Empresa toda</p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Meta em R$</label>
                  <input
                    type="number"
                    value={metas.geral?.valor ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, geral: { ...(prev.geral || { valor: '', quantidade: '' }), valor: e.target.value } }))}
                                            placeholder="Ex: 50000"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Meta em quantidade</label>
                  <input
                    type="number"
                    value={metas.geral?.quantidade ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, geral: { ...(prev.geral || { valor: '', quantidade: '' }), quantidade: e.target.value } }))}
                                            placeholder="Ex: 10"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => salvarMetaUsuario(null, null)}
                disabled={salvandoMeta === 'geral'}
                                    className="text-xs text-brand-navy hover:underline"
              >
{salvandoMeta === 'geral' ? 'Salvando...' : 'Salvar meta da empresa'}

              </button>
                                    </div>

{usuarios.map(u => (
                  <div key={u.id} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">{u.nome}</p>
                 <div className="grid grid-cols-2 gap-3 mb-2">
                   <div>
                     <label className="block text-xs text-slate-500 mb-1">Meta em R$</label>
                     <input
                       type="number"
                       value={metas[u.id]?.valor ?? ''}
                      onChange={e => setMetas(prev => ({ ...prev, [u.id]: { ...(prev[u.id] || { valor: '', quantidade: '' }), valor: e.target.value } }))}
                                                placeholder="Ex: 15000"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Meta em quantidade</label>
                    <input
                      type="number"
                      value={metas[u.id]?.quantidade ?? ''}
                      onChange={e => setMetas(prev => ({ ...prev, [u.id]: { ...(prev[u.id] || { valor: '', quantidade: '' }), quantidade: e.target.value } }))}
                                                placeholder="Ex: 3"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => salvarMetaUsuario(u.id, u.nome)}
                  disabled={salvandoMeta === u.id}
                                        className="text-xs text-brand-navy hover:underline"
                >
{salvandoMeta === u.id ? 'Salvando...' : 'Salvar meta'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Save size={16} /> Backup e restauração
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            O sistema faz um backup automático todo dia. Você também pode fazer um backup manual agora, e restaurar qualquer backup salvo se algo der errado. Ao restaurar, um backup do estado atual é salvo automaticamente antes, então dá pra voltar atrás.
                          </p>

          <button
            onClick={fazerBackupAgora}
            disabled={fazendoBackup}
            className="w-full py-3 mb-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16} />
{fazendoBackup ? 'Fazendo backup...' : 'Fazer backup agora'}
          </button>

{msgBackup && <p className="text-sm text-brand-teal mb-3">{msgBackup}</p>}

          <div className="space-y-2">
{backups.length === 0 && (
                  <p className="text-xs text-slate-400">Nenhum backup ainda.</p>
             )}
{backups.map(b => (
                  <div key={b.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                   <p className="text-sm text-slate-700 font-medium">
 {new Date(b.created_at).toLocaleString('pt-BR')}
                   </p>
                   <p className="text-xs text-slate-400">
 {b.tipo === 'manual' ? 'Manual' : b.tipo === 'automatico' ? 'Automático (diário)' : 'Segurança (pré-restauração)'}
 {b.criado_por_nome ? ` — ${b.criado_por_nome}` : ''}
 {b.resumo ? ` — ${Object.values(b.resumo).reduce((a: number, n: any) => a + Number(n || 0), 0)} registros` : ''}
                   </p>
                 </div>
                 <button
                   onClick={() => restaurarBackupComConfirmacao(b)}
                  disabled={restaurandoId === b.id}
                                        className="shrink-0 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw size={13} />
{restaurandoId === b.id ? 'Restaurando...' : 'Restaurar'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <LayoutGrid size={16} /> Setores do sistema
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Edite o nome, o grupo, a ordem e a descrição de cada setor que aparece no menu de Setores. Isso não liga nem desliga nenhuma funcionalidade, só muda como o setor aparece na tela.
                          </p>
          <div className="space-y-4">
{GRUPOS_ORDEM.map(grupo => {
                  const itens = agruparSetores(setores)[grupo] || []
                                    if (itens.length === 0) return null
                  return (
                                      <div key={grupo}>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{grupo}</p>
                      <div className="space-y-2">
    {itens.map(s => {
                              const edit = setoresEdit[s.id] || { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
                              return (
                                                          <div key={s.id} className="border border-slate-100 rounded-xl p-3 space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={edit.nome}
                                   onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, nome: e.target.value } }))}
                                                                     placeholder="Nome do setor"
                                   className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                                 />
                                 <select
                                   value={edit.grupo}
                                  onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, grupo: e.target.value } }))}
                                                                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                                >
    {GRUPOS_ORDEM.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                      ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <input
                                  type="number"
                                  value={edit.ordem}
                               onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, ordem: e.target.value } }))}
                                                                 placeholder="Ordem"
                               className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                             />
                             <input
                               type="text"
                               value={edit.descricao}
                              onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, descricao: e.target.value } }))}
                                                                placeholder="Descrição (opcional)"
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                          </div>
                          <button
                            onClick={() => salvarSetor(s.id)}
                            disabled={salvandoSetor === s.id}
                                                            className="text-xs text-brand-navy hover:underline"
                          >
{salvandoSetor === s.id ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      )

})}
                  </div>
                </div>
              )
})}
          </div>
        </section>
      </main>
    </div>
  )
}
