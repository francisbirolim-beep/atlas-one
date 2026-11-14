'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokenAtual, usuarioAtual, usuarioCacheLocal } from '@/lib/auth'
import { homeConfigPadrao, lerHomeUsuarioConfig, temModulo, type HomeUsuarioConfig } from '@/lib/homeUsuario'
import HomeExecutiveHero from '@/components/system/HomeExecutiveHero'
import HomePainelGeralAcessos from '@/components/system/HomePainelGeralAcessos'
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

  const temTrabalho = temModulo(config, 'tarefas') || temModulo(config, 'calendario')

  return (
    <div className="atlas-home-dashboard w-full max-w-full overflow-x-hidden">
      <HomeExecutiveHero modulos={config.modulos} />
      <HomePainelGeralAcessos />

      {temTrabalho && (
        <section className="atlas-home-mobile-full mx-auto w-full max-w-[1500px] px-3 pt-3 pb-6 sm:px-4 md:px-8">
          <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
            {temModulo(config, 'tarefas') && <HomePersonalKanban />}
            {temModulo(config, 'calendario') && <HomeCalendarBlock />}
          </div>
        </section>
      )}

      {/* O formulário original permanece ativo; a lista foi substituída pelos mesmos registros no Kanban. */}
      {temModulo(config, 'tarefas') && <HomeTasksBlock ocultarPainel />}
    </div>
  )
}
