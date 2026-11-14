'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokenAtual, usuarioAtual, usuarioCacheLocal } from '@/lib/auth'
import { homeConfigPadrao, lerHomeUsuarioConfig, temModulo, type HomeUsuarioConfig } from '@/lib/homeUsuario'
import HomeExecutiveHero from '@/components/system/HomeExecutiveHero'
import HomeTasksBlock from '@/components/system/HomeTasksBlock'
import HomeCalendarBlock from '@/components/system/HomeCalendarBlock'
import HomePersonalKanban from '@/components/system/HomePersonalKanban'

export default function HomeDashboard() {
  const router = useRouter()
  const usuarioInicial = usuarioCacheLocal()
  const configInicial = homeConfigPadrao(usuarioInicial?.role || 'funcionario')
  const [config, setConfig] = useState<HomeUsuarioConfig>(configInicial)

  useEffect(() => {
    let ativo = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const aplicar = (carregada: HomeUsuarioConfig) => {
      if (!ativo) return
      setConfig(carregada)
    }

    void (async () => {
      const cache = usuarioCacheLocal()
      if (cache) aplicar(homeConfigPadrao(cache.role))

      const usuario = await Promise.race([
        usuarioAtual(),
        new Promise<Awaited<ReturnType<typeof usuarioAtual>>>(resolve => {
          timer = setTimeout(() => resolve(cache), 1200)
        }),
      ])
      if (!ativo || !usuario) return

      const padrao = homeConfigPadrao(usuario.role)
      aplicar(padrao)

      const promessaConfig = lerHomeUsuarioConfig(usuario)
      promessaConfig.then(aplicar).catch(() => undefined)

      const rapida = await Promise.race([
        promessaConfig,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1200)),
      ])
      if (rapida) aplicar(rapida)
    })()

    return () => {
      ativo = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Redirecionar só depois de confirmar a permissão no backend.
  useEffect(() => {
    if (!config.paginaInicial || config.paginaInicial === 'padrao') return
    let ativo = true
    void (async () => {
      const token = await tokenAtual()
      if (!ativo || !token) return
      const resposta = await fetch('/api/painel-geral-acesso', {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
      }).catch(() => null)
      if (!ativo || !resposta?.ok) return
      const acesso = await resposta.json().catch(() => null)
      if (!ativo) return
      if (config.paginaInicial === 'visao-geral-projetos' && acesso?.visaoGeral === true)
        router.replace('/visao-geral-projetos')
      if (config.paginaInicial === 'relatorios-instalacoes' && acesso?.relatorioInstalacoes === true)
        router.replace('/relatorios/instalacoes')
    })()
    return () => { ativo = false }
  }, [config.paginaInicial, router])

  const mostraTarefas = temModulo(config, 'tarefas')
  const mostraCalendario = temModulo(config, 'calendario')
  const temTrabalho = mostraTarefas || mostraCalendario

  return (
    <div className="atlas-home-dashboard w-full max-w-full overflow-x-hidden">
      <HomeExecutiveHero modulos={config.modulos} />

      {temTrabalho && (
        <section className="atlas-home-mobile-full mx-auto w-full max-w-[1500px] px-3 pt-4 pb-6 sm:px-4 md:px-8">
          <div className={mostraTarefas && mostraCalendario
            ? 'grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)]'
            : 'grid min-w-0 grid-cols-1 gap-4'}>
            {mostraTarefas && <HomeTasksBlock />}
            {mostraCalendario && <HomeCalendarBlock />}
          </div>
          {mostraTarefas && <div className="mt-4"><HomePersonalKanban /></div>}
        </section>
      )}
    </div>
  )
}
