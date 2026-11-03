import 'server-only'
import { createDecipheriv } from 'node:crypto'
import { ASSINATURA_CIFRADA_B64 } from '@/lib/financeiroAssinaturaCriptografada'

// A assinatura é protegida por uma chave armazenada exclusivamente como secret no Vercel.
// O código e o repositório público contêm apenas o criptograma AES-256-GCM.
export function assinaturaReciboAutorizada(): string | null {
  const chave = process.env.ATLAS_RECIBO_ASSINATURA_CHAVE
  if (!chave) return null
  try {
    const key = Buffer.from(chave.trim(), 'base64')
    const file = Buffer.from(ASSINATURA_CIFRADA_B64, 'base64')
    if (key.length !== 32 || file.subarray(0, 8).toString() !== 'ATLSIG01') return null
    const iv = file.subarray(8, 20)
    const tag = file.subarray(20, 36)
    const encrypted = file.subarray(36)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const original = Buffer.concat([decipher.update(encrypted), decipher.final()])
    if (original.length < 2000 || original.subarray(0, 4).toString('hex') !== '89504e47') return null
    return 'data:image/png;base64,' + original.toString('base64')
  } catch {
    console.error('Assinatura do recibo indisponível: não foi possível descriptografar o arquivo autorizado.')
    return null
  }
}
