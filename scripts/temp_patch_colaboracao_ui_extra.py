from pathlib import Path

p = Path('components/system/HomeOperationsWorkspace.tsx')
text = p.read_text(encoding='utf-8')

text = text.replace(
    "import { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'",
    "import { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'\nimport { listarNotificacoes } from '@/lib/notificacoes'\nimport type { Notificacao } from '@/lib/tipos'",
    1,
)

old = """  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [carregando, setCarregando] = useState(true)"""
new = """  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [notificacoesPersistentes, setNotificacoesPersistentes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)"""
if old not in text: raise SystemExit('persistent state marker not found')
text = text.replace(old, new, 1)

old = """      const [tfs, cls, evs] = await Promise.all([
        listarTarefas(u.id),
        listarColunasTarefas(u.id),
        listarEventosDoUsuario(u.id),
      ])"""
new = """      const [tfs, cls, evs, notifs] = await Promise.all([
        listarTarefas(u.id),
        listarColunasTarefas(u.id),
        listarEventosDoUsuario(u.id),
        listarNotificacoes(u.id, 6),
      ])"""
if old not in text: raise SystemExit('load promise marker not found')
text = text.replace(old, new, 1)
text = text.replace("      setEventos(evs)\n      setCarregando(false)", "      setEventos(evs)\n      setNotificacoesPersistentes(notifs)\n      setCarregando(false)", 1)

marker = """  const tituloDia = mesmoDia(diaSelecionado, agora)"""
insert = """  const alertasPainel = useMemo<AlertaHome[]>(() => {
    const persistentes: AlertaHome[] = notificacoesPersistentes.slice(0, 4).map(n => ({
      id: `notif-${n.id}`,
      titulo: n.titulo,
      detalhe: n.mensagem || n.criado_por_nome || 'Nova notificação',
      tipo: n.categoria === 'agenda' ? 'agenda' : n.categoria === 'tarefas' ? 'tarefa' : 'convite',
      href: n.href || '/',
    }))
    return [...persistentes, ...alertas].slice(0, 4)
  }, [notificacoesPersistentes, alertas])

"""
if marker not in text: raise SystemExit('painel insertion marker not found')
text = text.replace(marker, insert + marker, 1)

text = text.replace("{alertas.length} agora", "{alertasPainel.length} agora", 1)
text = text.replace("alertas.length === 0", "alertasPainel.length === 0", 1)
text = text.replace("alertas.map(alerta =>", "alertasPainel.map(alerta =>", 1)

# Prioridade só faz sentido na UI desta V1 quando a tarefa está sendo atribuída a outra pessoa.
old_priority = """<div><label className=\"mb-1 block text-xs font-medium text-slate-500\">Prioridade</label><select value={prioridadeTarefa} onChange={e => setPrioridadeTarefa(e.target.value as PrioridadeTarefa)} className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"><option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option></select></div>"""
new_priority = """{responsavelTarefaId && responsavelTarefaId !== usuario?.id && <div><label className=\"mb-1 block text-xs font-medium text-slate-500\">Prioridade</label><select value={prioridadeTarefa} onChange={e => setPrioridadeTarefa(e.target.value as PrioridadeTarefa)} className=\"w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm\"><option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option></select></div>}"""
if old_priority not in text: raise SystemExit('home priority marker not found')
text = text.replace(old_priority, new_priority, 1)
p.write_text(text, encoding='utf-8')

p = Path('app/tarefas/page.tsx')
text = p.read_text(encoding='utf-8')
old = """            <div>
              <label className=\"text-xs text-slate-400 mb-1 block\">Prioridade</label>
              <select value={prioridadeNova} onChange={(e) => setPrioridadeNova(e.target.value as PrioridadeTarefa)} className=\"w-full border border-slate-300 rounded-xl px-3 py-2 text-sm\">
                <option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option>
              </select>
            </div>"""
new = """            {responsavelNova && responsavelNova !== usuario?.id && <div>
              <label className=\"text-xs text-slate-400 mb-1 block\">Prioridade</label>
              <select value={prioridadeNova} onChange={(e) => setPrioridadeNova(e.target.value as PrioridadeTarefa)} className=\"w-full border border-slate-300 rounded-xl px-3 py-2 text-sm\">
                <option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option>
              </select>
            </div>}"""
if old not in text: raise SystemExit('task page priority marker not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
