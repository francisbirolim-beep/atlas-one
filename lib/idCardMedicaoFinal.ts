import { createHash } from 'crypto'

// UUID v8 determinístico e escopado por empresa + Medição Final.
// Usar UUID fixo junto ao índice primário evita dois cards idênticos
// mesmo se o usuário enviar do computador e do celular simultaneamente.
export function idCardMedicaoFinal(empresaId: string, medicaoId: string): string {
  const identificacao = 'atlas:producao:medicao-final:' + empresaId + ':' + medicaoId
  const bytes = createHash('sha256').update(identificacao).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = bytes.toString('hex')
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-')
}
