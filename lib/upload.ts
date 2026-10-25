import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

function extensaoSegura(file: File): string {
  const nome = file.name || ''
  const extNome = nome.includes('.') ? nome.split('.').pop()?.toLowerCase() : ''
  if (extNome && /^[a-z0-9]{2,8}$/.test(extNome)) return extNome

  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  return porMime[file.type] || 'jpg'
}

async function subirComTentativas(pasta: string, file: File): Promise<string | null> {
  if (!file || file.size <= 0) {
    console.error('Upload ignorado: arquivo vazio.')
    return null
  }

  // O bucket suporta até 50 MB, mas limitar no cliente evita travamentos e uploads
  // muito demorados no celular.
  if (file.size > 25 * 1024 * 1024) {
    console.error('Upload ignorado: foto maior que 25 MB.')
    return null
  }

  const ext = extensaoSegura(file)
  let ultimoErro: unknown = null

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    const path = `${pasta}/${uuidv4()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    })

    if (!error) {
      const { data } = supabase.storage.from('fotos').getPublicUrl(path)
      if (data.publicUrl) return data.publicUrl
      ultimoErro = new Error('Storage não retornou URL pública.')
    } else {
      ultimoErro = error
      console.error(`Erro ao subir foto (tentativa ${tentativa}/3):`, error)
    }

    if (tentativa < 3) {
      await new Promise(resolve => setTimeout(resolve, 350 * tentativa))
    }
  }

  console.error('Não foi possível concluir o upload da foto:', ultimoErro)
  return null
}

// iPhones podem entregar HEIC/HEIF: o Safari pode visualizar, mas navegadores
// de computador frequentemente não. Converter apenas esses formatos em JPEG
// antes de enviar garante miniatura multiplataforma sem afetar fotos já salvas.
async function fotoCompatibilidadeDesktop(file: File): Promise<File> {
  const heic = /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  if (!heic) return file
  if (typeof document === 'undefined') throw new Error('Conversão HEIC indisponível neste dispositivo.')
  const urlLocal = URL.createObjectURL(file)
  try {
    const imagem = new Image()
    await new Promise<void>((resolve, reject) => {
      imagem.onload = () => resolve()
      imagem.onerror = () => reject(new Error('Não foi possível ler a foto HEIC.'))
      imagem.src = urlLocal
    })
    const maior = Math.max(imagem.naturalWidth, imagem.naturalHeight)
    if (!maior) throw new Error('Foto HEIC sem dimensões válidas.')
    const escala = Math.min(1, 2560 / maior)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Conversão de imagem indisponível.')
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(resultado => resultado ? resolve(resultado) : reject(new Error('Falha ao converter HEIC.')), 'image/jpeg', 0.88)
    })
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '') + '.jpg', {
      type: 'image/jpeg', lastModified: file.lastModified,
    })
  } finally {
    URL.revokeObjectURL(urlLocal)
  }
}

export async function uploadFoto(file: File): Promise<string | null> {
  try {
    return await subirComTentativas('orcamentos', await fotoCompatibilidadeDesktop(file))
  } catch (erro) {
    console.error('A foto não pôde ser preparada para visualização em outros dispositivos:', erro)
    return null
  }
}

export async function uploadFotoMedicao(file: File): Promise<string | null> {
  return subirComTentativas('medicoes', file)
}

export async function uploadArquivo(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `anexos/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('Erro ao subir arquivo:', error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl
}

// Foto do produto (Cadastro > Produtos), usada no catálogo e opcionalmente
// no PDF do Orçamento Balcão.
export async function uploadFotoProduto(file: File): Promise<string | null> {
  return subirComTentativas('produtos', file)
}

// Logo/identidade visual da empresa que usa o Atlas One. Mantém o arquivo
// no bucket já existente para não exigir migration nem novo bucket.
export async function uploadLogoEmpresa(file: File): Promise<string | null> {
  return subirComTentativas('empresa', file)
}

// Desenho técnico/foto de uma configuração validada de orçamento.
// Mantém cada imagem separada do cadastro genérico do produto porque duas
// configurações da mesma tipologia podem ter composições visuais diferentes.
export async function uploadImagemConfiguracao(file: File): Promise<string | null> {
  return subirComTentativas('configuracoes', file)
}
