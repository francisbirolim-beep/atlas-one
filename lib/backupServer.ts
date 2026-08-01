import { supabaseAdmin } from './supabaseAdmin'
import { TABELAS_BACKUP } from './backup'

// Codigo de servidor (usa a chave admin, nunca importar em componentes 'use client').

async function buscarTodasLinhas(tabela: string): Promise<any[]> {
    const linhas: any[] = []
        let from = 0
    const tamanhoPagina = 1000
    while (true) {
          const { data, error } = await supabaseAdmin
            .from(tabela)
            .select('*')
            .range(from, from + tamanhoPagina - 1)
          if (error) throw new Error(`Erro ao ler ${tabela}: ${error.message}`)
          if (!data || data.length === 0) break
          linhas.push(...data)
          if (data.length < tamanhoPagina) break
          from += tamanhoPagina
    }
    return linhas
}

export async function capturarSnapshot(): Promise<{
    tabelas: Record<string, any[]>
    resumo: Record<string, number>
}> {
    const tabelas: Record<string, any[]> = {}
        const resumo: Record<string, number> = {}
            for (const tabela of TABELAS_BACKUP) {
                  const linhas = await buscarTodasLinhas(tabela)
                  tabelas[tabela] = linhas
                  resumo[tabela] = linhas.length
            }
    return { tabelas, resumo }
}

export async function salvarBackup(
    tipo: 'manual' | 'automatico' | 'pre_restauracao',
    criadoPorNome: string | null
  ) {
    const { tabelas, resumo } = await capturarSnapshot()
    const { data, error } = await supabaseAdmin
      .from('backups')
      .insert({ tipo, criado_por_nome: criadoPorNome, tabelas, resumo })
      .select('id, created_at, tipo, resumo')
      .single()
    if (error) throw new Error(`Erro ao salvar backup: ${error.message}`)
    return data
}

// Restaura os dados de um backup: apaga as linhas atuais (na ordem inversa,
// filhas antes das pais) e insere de volta os dados salvos (pais antes das filhas).
export async function restaurarSnapshot(tabelas: Record<string, any[]>) {
    const ordemExclusao = [...TABELAS_BACKUP].reverse()

  for (const tabela of ordemExclusao) {
        const { error } = await supabaseAdmin
          .from(tabela)
          .delete()
          .not('id', 'is', null) // condicao sempre verdadeira, necessaria pro Supabase aceitar delete em massa
      if (error) throw new Error(`Erro ao limpar ${tabela} antes de restaurar: ${error.message}`)
  }

  for (const tabela of TABELAS_BACKUP) {
        const linhas = tabelas[tabela] || []
              if (linhas.length === 0) continue
        const tamanhoLote = 500
        for (let i = 0; i < linhas.length; i += tamanhoLote) {
                const lote = linhas.slice(i, i + tamanhoLote)
                const { error } = await supabaseAdmin.from(tabela).insert(lote)
                if (error) throw new Error(`Erro ao restaurar ${tabela}: ${error.message}`)
        }
  }
}
