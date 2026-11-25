// Um limite de espera não altera permissões nem cancela escritas.
export async function comLimiteConsulta<T>(consulta: PromiseLike<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(consulta),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('O servidor demorou para responder. Tente novamente.')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function fetchConsulta(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const controlador = new AbortController()
  const cancelar = () => controlador.abort()
  if (init.signal?.aborted) cancelar()
  else init.signal?.addEventListener('abort', cancelar, { once: true })
  const timer = setTimeout(cancelar, ms)
  try {
    return await fetch(url, { ...init, signal: controlador.signal })
  } catch (e) {
    if (controlador.signal.aborted) throw new Error('O servidor demorou para responder. Tente novamente.')
    throw e
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', cancelar)
  }
}
