import { NextResponse } from 'next/server'

export async function POST() {
  // A implementacao legada restaura snapshots globais: apaga as linhas atuais
  // das tabelas de backup e reinsere o snapshot inteiro. Em ambiente multi-tenant,
  // nenhum usuario empresarial pode executar essa operacao. A restauracao volta a
  // ser liberada somente quando existir escopo por empresa_id, teste A x B e
  // procedimento de disaster recovery aprovado.
  return NextResponse.json(
    {
      error: 'Restauracao global temporariamente desabilitada no modo multi-tenant.',
      code: 'GLOBAL_RESTORE_DISABLED_MULTI_TENANT',
    },
    { status: 403 },
  )
}