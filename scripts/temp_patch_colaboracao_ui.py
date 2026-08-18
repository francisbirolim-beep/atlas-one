from pathlib import Path

# 1) lib/tipos.ts
p = Path('lib/tipos.ts')
text = p.read_text(encoding='utf-8')
old = """export interface TarefaPessoal {
      id: string
      usuario_id: string
      coluna_id: string
      titulo: string
      descricao?: string | null
      data_hora?: string | null
      concluida_em?: string | null
      recorrencia_tipo?: string | null
      recorrencia_valor?: number | null
      regra_origem_id?: string | null
      created_at?: string
}

export type StatusConvite = 'pendente' | 'aceito' | 'recusado'"""
new = """export interface TarefaPessoal {
      id: string
      usuario_id: string
      coluna_id: string
      titulo: string
      descricao?: string | null
      data_hora?: string | null
      concluida_em?: string | null
      recorrencia_tipo?: string | null
      recorrencia_valor?: number | null
      regra_origem_id?: string | null
      solicitante_id?: string | null
      solicitante_nome?: string | null
      atribuida_em?: string | null
      prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente'
      created_at?: string
}

export interface Notificacao {
      id: string
      usuario_id: string
      categoria: 'tarefas' | 'agenda' | 'chat' | 'operacao'
      tipo: string
      titulo: string
      mensagem?: string | null
      href?: string | null
      origem_tipo?: string | null
      origem_id?: string | null
      criado_por_id?: string | null
      criado_por_nome?: string | null
      lida_em?: string | null
      created_at: string
}

export interface NotificacaoPreferencias {
      usuario_id: string
      som_ativo: boolean
      som_volume: number
      tarefas: boolean
      agenda: boolean
      chat: boolean
      operacao: boolean
      updated_at?: string
}

export type StatusConvite = 'pendente' | 'aceito' | 'recusado'"""
if old not in text:
    raise SystemExit('tipos marker not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 2) HomeOperationsWorkspace
p = Path('components/system/HomeOperationsWorkspace.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'", "import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'\nimport { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'")

old = """  const [horaTarefa, setHoraTarefa] = useState('')
  const [tituloEvento, setTituloEvento] = useState('')"""
new = """  const [horaTarefa, setHoraTarefa] = useState('')
  const [responsavelTarefaId, setResponsavelTarefaId] = useState('')
  const [prioridadeTarefa, setPrioridadeTarefa] = useState<PrioridadeTarefa>('normal')
  const [usuariosTarefa, setUsuariosTarefa] = useState<{ id: string; nome: string }[]>([])
  const [tituloEvento, setTituloEvento] = useState('')"""
if old not in text: raise SystemExit('home states marker not found')
text = text.replace(old, new, 1)

text = text.replace("    const novaTarefa = () => setModalTarefa(true)", "    const novaTarefa = () => void abrirTarefa()")

marker = """  async function salvarTarefa() {
    if (!usuario || !tituloTarefa.trim()) return
    setSalvando(true)
    const colunaId = colunas[0]?.id || await primeiraColunaTarefaId(usuario.id)
    if (colunaId) {
      const dataHora = dataTarefa
        ? new Date(`${dataTarefa}T${horaTarefa || '09:00'}:00`).toISOString()
        : null
      const criada = await criarTarefa(usuario.id, colunaId, tituloTarefa.trim(), undefined, dataHora)
      if (criada) setTarefas(prev => [...prev, criada])
    }
    setTituloTarefa('')
    setHoraTarefa('')
    setModalTarefa(false)
    setSalvando(false)
  }
"""
replacement = """  async function abrirTarefa() {
    if (!usuario) return
    setResponsavelTarefaId(usuario.id)
    setPrioridadeTarefa('normal')
    setModalTarefa(true)
    if (usuariosTarefa.length === 0) {
      const outros = await listarUsuariosConvidaveis(usuario.id)
      setUsuariosTarefa([{ id: usuario.id, nome: usuario.nome }, ...outros])
    }
  }

  async function salvarTarefa() {
    if (!usuario || !tituloTarefa.trim()) return
    setSalvando(true)
    const responsavelId = responsavelTarefaId || usuario.id
    const dataHora = dataTarefa
      ? new Date(`${dataTarefa}T${horaTarefa || '09:00'}:00`).toISOString()
      : null

    if (responsavelId === usuario.id) {
      const colunaId = colunas[0]?.id || await primeiraColunaTarefaId(usuario.id)
      if (colunaId) {
        const criada = await criarTarefa(usuario.id, colunaId, tituloTarefa.trim(), undefined, dataHora)
        if (criada) setTarefas(prev => [...prev, criada])
      }
    } else {
      const resultado = await atribuirTarefa({
        responsavelId,
        titulo: tituloTarefa.trim(),
        dataHora,
        prioridade: prioridadeTarefa,
      })
      if (!resultado.ok) {
        alert(resultado.error || 'Não foi possível atribuir a tarefa.')
        setSalvando(false)
        return
      }
      const nome = usuariosTarefa.find(u => u.id === responsavelId)?.nome || 'o responsável'
      alert(`Tarefa atribuída para ${nome}.`)
    }

    setTituloTarefa('')
    setHoraTarefa('')
    setModalTarefa(false)
    setSalvando(false)
  }
"""
if marker not in text: raise SystemExit('home save marker not found')
text = text.replace(marker, replacement, 1)
text = text.replace("<button onClick={() => setModalTarefa(true)} className=\"rounded-lg", "<button onClick={() => void abrirTarefa()} className=\"rounded-lg", 1)

old_modal = """<div className=\"space-y-3\"><input value={tituloTarefa} onChange={e => setTituloTarefa(e.target.value)} placeholder=\"O que precisa ser feito?\" autoFocus className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500\"/><div className=\"grid grid-cols-2 gap-3\"><input type=\"date\" value={dataTarefa} onChange={e => setDataTarefa(e.target.value)} className=\"rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"/><input type=\"time\" value={horaTarefa} onChange={e => setHoraTarefa(e.target.value)} className=\"rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"/></div><button disabled={salvando || !tituloTarefa.trim()} onClick={() => void salvarTarefa()} className=\"w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40\">{salvando ? 'Salvando...' : 'Criar tarefa'}</button></div>"""
new_modal = """<div className=\"space-y-3\"><input value={tituloTarefa} onChange={e => setTituloTarefa(e.target.value)} placeholder=\"O que precisa ser feito?\" autoFocus className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500\"/><div><label className=\"mb-1 block text-xs font-medium text-slate-500\">Responsável</label><select value={responsavelTarefaId || usuario?.id || ''} onChange={e => setResponsavelTarefaId(e.target.value)} className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm\">{usuariosTarefa.map(u => <option key={u.id} value={u.id}>{u.id === usuario?.id ? `${u.nome} (eu)` : u.nome}</option>)}</select></div><div className=\"grid grid-cols-2 gap-3\"><input type=\"date\" value={dataTarefa} onChange={e => setDataTarefa(e.target.value)} className=\"rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"/><input type=\"time\" value={horaTarefa} onChange={e => setHoraTarefa(e.target.value)} className=\"rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"/></div><div><label className=\"mb-1 block text-xs font-medium text-slate-500\">Prioridade</label><select value={prioridadeTarefa} onChange={e => setPrioridadeTarefa(e.target.value as PrioridadeTarefa)} className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"><option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option></select></div><button disabled={salvando || !tituloTarefa.trim()} onClick={() => void salvarTarefa()} className=\"w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40\">{salvando ? 'Salvando...' : ((responsavelTarefaId && responsavelTarefaId !== usuario?.id) ? 'Atribuir tarefa' : 'Criar tarefa')}</button></div>"""
if old_modal not in text: raise SystemExit('home modal marker not found')
text = text.replace(old_modal, new_modal, 1)

old_row = """<span className=\"min-w-0 flex-1 truncate text-sm text-slate-100\">{t.titulo}</span>
                <span className={`flex-shrink-0 text-xs ${vencida ? 'font-semibold text-red-300' : 'text-slate-500'}`}>{vencida ? 'Atrasada' : t.data_hora ? hora(t.data_hora) : 'Sem prazo'}</span>"""
new_row = """<span className=\"min-w-0 flex-1\"><span className=\"block truncate text-sm text-slate-100\">{t.titulo}</span>{t.solicitante_nome && t.solicitante_id !== usuario?.id && <span className=\"block truncate text-[10px] text-blue-300\">Criada por {t.solicitante_nome}</span>}</span>
                <span className={`flex-shrink-0 text-xs ${vencida ? 'font-semibold text-red-300' : 'text-slate-500'}`}>{vencida ? 'Atrasada' : t.data_hora ? hora(t.data_hora) : 'Sem prazo'}</span>"""
if old_row not in text: raise SystemExit('home task row marker not found')
text = text.replace(old_row, new_row, 1)
p.write_text(text, encoding='utf-8')

# 3) app/tarefas/page.tsx
p = Path('app/tarefas/page.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("AlertTriangle, Calendar, Repeat", "AlertTriangle, Calendar, Repeat, Users")
text = text.replace("import { usuarioAtual } from '@/lib/auth'", "import { usuarioAtual } from '@/lib/auth'\nimport { listarUsuariosConvidaveis } from '@/lib/eventos'\nimport { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'")

old = """  const [repetirValorNova, setRepetirValorNova] = useState(5)
  const [selecionada, setSelecionada] = useState<TarefaPessoal | null>(null)"""
new = """  const [repetirValorNova, setRepetirValorNova] = useState(5)
  const [responsavelNova, setResponsavelNova] = useState('')
  const [prioridadeNova, setPrioridadeNova] = useState<PrioridadeTarefa>('normal')
  const [usuariosTarefa, setUsuariosTarefa] = useState<{ id: string; nome: string }[]>([])
  const [selecionada, setSelecionada] = useState<TarefaPessoal | null>(null)"""
if old not in text: raise SystemExit('tarefas state marker not found')
text = text.replace(old, new, 1)

old = """  function abrirNovaTarefa(colunaId: string) {
    setNovaEm(colunaId)
    setTituloNovo('')
    setDescNova('')
    setDataNova('')
    setRepetirNova('')
    setRepetirValorNova(5)
  }"""
new = """  function abrirNovaTarefa(colunaId: string) {
    setNovaEm(colunaId)
    setTituloNovo('')
    setDescNova('')
    setDataNova('')
    setRepetirNova('')
    setRepetirValorNova(5)
    setPrioridadeNova('normal')
    if (usuario) {
      setResponsavelNova(usuario.id)
      if (usuariosTarefa.length === 0) {
        listarUsuariosConvidaveis(usuario.id).then(outros => setUsuariosTarefa([{ id: usuario.id, nome: usuario.nome }, ...outros]))
      }
    }
  }"""
if old not in text: raise SystemExit('tarefas open marker not found')
text = text.replace(old, new, 1)

old = """  async function salvarNovaTarefa() {
    if (!usuario || !novaEm || !tituloNovo.trim()) return
    if (repetirNova) {
      if (!dataNova) { alert('Defina uma data para a tarefa repetir a partir dela.'); return }
      await criarTarefaRecorrente(usuario.id, novaEm, tituloNovo.trim(), new Date(dataNova).toISOString(), repetirNova, repetirValorNova, descNova.trim() || undefined)
      const tfs = await listarTarefas(usuario.id)
      setTarefas(tfs)
    } else {
      const t = await criarTarefa(usuario.id, novaEm, tituloNovo.trim(), descNova.trim() || undefined, dataNova || null)
      if (t) setTarefas((prev) => [...prev, t])
    }
    setNovaEm(null)
  }"""
new = """  async function salvarNovaTarefa() {
    if (!usuario || !novaEm || !tituloNovo.trim()) return
    const responsavelId = responsavelNova || usuario.id
    if (responsavelId !== usuario.id) {
      if (repetirNova) {
        alert('Nesta versão, tarefas recorrentes só podem ser criadas para você. Para outro usuário, crie uma tarefa única.')
        return
      }
      const resultado = await atribuirTarefa({
        responsavelId,
        titulo: tituloNovo.trim(),
        descricao: descNova.trim() || undefined,
        dataHora: dataNova ? new Date(dataNova).toISOString() : null,
        prioridade: prioridadeNova,
      })
      if (!resultado.ok) {
        alert(resultado.error || 'Não foi possível atribuir a tarefa.')
        return
      }
      const nome = usuariosTarefa.find(u => u.id === responsavelId)?.nome || 'o responsável'
      alert(`Tarefa atribuída para ${nome}.`)
      setNovaEm(null)
      return
    }

    if (repetirNova) {
      if (!dataNova) { alert('Defina uma data para a tarefa repetir a partir dela.'); return }
      await criarTarefaRecorrente(usuario.id, novaEm, tituloNovo.trim(), new Date(dataNova).toISOString(), repetirNova, repetirValorNova, descNova.trim() || undefined)
      const tfs = await listarTarefas(usuario.id)
      setTarefas(tfs)
    } else {
      const t = await criarTarefa(usuario.id, novaEm, tituloNovo.trim(), descNova.trim() || undefined, dataNova || null)
      if (t) setTarefas((prev) => [...prev, t])
    }
    setNovaEm(null)
  }"""
if old not in text: raise SystemExit('tarefas save marker not found')
text = text.replace(old, new, 1)

modal_marker = """            <textarea
              value={descNova}
              onChange={(e) => setDescNova(e.target.value)}
              placeholder=\"Descricao (opcional)\"
              className=\"w-full border border-slate-300 rounded-xl px-3 py-2 text-sm\"
              rows={2}
            />"""
modal_add = modal_marker + """
            <div>
              <label className=\"text-xs text-slate-400 flex items-center gap-1 mb-1\"><Users size={12} /> Responsável</label>
              <select value={responsavelNova || usuario?.id || ''} onChange={(e) => setResponsavelNova(e.target.value)} className=\"w-full border border-slate-300 rounded-xl px-3 py-2 text-sm\">
                {usuariosTarefa.map(u => <option key={u.id} value={u.id}>{u.id === usuario?.id ? `${u.nome} (eu)` : u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className=\"text-xs text-slate-400 mb-1 block\">Prioridade</label>
              <select value={prioridadeNova} onChange={(e) => setPrioridadeNova(e.target.value as PrioridadeTarefa)} className=\"w-full border border-slate-300 rounded-xl px-3 py-2 text-sm\">
                <option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option>
              </select>
            </div>"""
if modal_marker not in text: raise SystemExit('tarefas modal marker not found')
text = text.replace(modal_marker, modal_add, 1)

selected_marker = """            {selecionada.descricao && <p className=\"text-sm text-slate-500\">{selecionada.descricao}</p>}"""
selected_add = selected_marker + """
            {selecionada.solicitante_nome && selecionada.solicitante_id !== usuario?.id && <p className=\"text-xs text-blue-600\">Criada por {selecionada.solicitante_nome}</p>}
            {selecionada.prioridade && selecionada.prioridade !== 'normal' && <p className={`text-xs font-semibold ${selecionada.prioridade === 'urgente' ? 'text-red-600' : selecionada.prioridade === 'alta' ? 'text-amber-600' : 'text-slate-500'}`}>Prioridade: {selecionada.prioridade}</p>}"""
if selected_marker not in text: raise SystemExit('selected marker not found')
text = text.replace(selected_marker, selected_add, 1)
p.write_text(text, encoding='utf-8')
