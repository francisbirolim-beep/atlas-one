import { supabase } from './supabase'

// Lista de tabelas incluidas no backup, na ordem de dependencia
// (tabelas "pai" primeiro). Para restaurar/excluir, a ordem e usada
// invertida (tabelas "filhas" primeiro), para nao violar chaves estrangeiras.
export const TABELAS_BACKUP = [
    'clientes',
    'usuarios',
    'setores',
    'kanban_colunas',
    'orcamentos',
    'permissoes',
    'historico',
    'crm_tarefas',
    'crm_interacoes',
    'crm_metas',
    'assistencias',
  ] as const

export type NomeTabelaBackup = (typeof TABELAS_BACKUP)[number]

export interface RegistroBackup {
    id: string
    created_at: string
    criado_por_nome?: string | null
    tipo: 'manual' | 'automatico' | 'pre_restauracao'
    resumo?: Record<string, number> | null
}

export async function listarBackups(): Promise<RegistroBackup[]> {
    const { data } = await supabase
      .from('backups')
      .select('id, created_at, criado_por_nome, tipo, resumo')
      .order('created_at', { ascending: false })
      .limit(30)
    return (data as RegistroBackup[]) || []
}

export async function criarBackupAgora(token: string) {
    const res = await fetch('/api/backup', {
          headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Erro ao criar backup')
    return json
}

export async function restaurarBackup(token: string, backupId: string) {
    const res = await fetch('/api/restaurar-backup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Erro ao restaurar backup')
    return json
}
