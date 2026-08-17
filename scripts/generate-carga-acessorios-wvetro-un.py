from pathlib import Path
import base64
import hashlib
import zlib

ROOT = Path('.')
CHUNKS = [ROOT / f'tmp/carga_un_{i:02d}.b64' for i in range(6)]
MIGRATION = ROOT / 'supabase/migrations/20260817141000_carga_acessorios_wvetro_un_v1.sql'
REPORT = ROOT / 'docs/tecnico/carga-acessorios-wvetro-un-2026-08-17.md'
EXPECTED_SHA256 = '4a0c3339107695d8e6a777ea2c7374696b0021c8da45aaa177a66a652f90ed63'
MARKER = '## PRODUTOS — IDENTIDADE TÉCNICA APLICADA E CARGA UN PREPARADA — 2026-08-17'

encoded = ''.join(path.read_text(encoding='utf-8').strip() for path in CHUNKS)
sql = zlib.decompress(base64.b64decode(encoded)).decode('utf-8')
actual_sha = hashlib.sha256(sql.encode('utf-8')).hexdigest()
if actual_sha != EXPECTED_SHA256:
    raise RuntimeError(f'Hash da migration divergente: {actual_sha}')
if sql.count("status_validacao = 'importado'") < 1 and "'importado'" not in sql:
    raise RuntimeError('Migration sem status importado esperado')
if 'v_total <> 649' not in sql or 'v_inseridos <> 649' not in sql:
    raise RuntimeError('Guardas de 649 registros não encontrados')
MIGRATION.write_text(sql, encoding='utf-8')

REPORT.write_text('''# Carga reconciliada de acessórios W.Vetro — unidade UN — 2026-08-17

## Estado do pré-requisito

A migration `20260816210000_produtos_identidade_tecnica_v1.sql` foi **aplicada em produção** pelo workflow `Supabase Database Control`, run **#79**, ID `32037239260`, em 2026-08-17.

O run confirmou:
- dry-run com somente a migration de identidade técnica pendente;
- confirmação exata `APPLY_PRODUCTION`;
- etapa `Apply pending migrations` concluída com sucesso;
- log `Applying migration 20260816210000_produtos_identidade_tecnica_v1.sql...` seguido de `Finished supabase db push.`.

## Escopo desta carga

A reconciliação completa encontrou **785 acessórios faltantes** no Atlas. Distribuição por unidade da fonte:

| Unidade origem | Faltantes |
|---|---:|
| UN | 649 |
| MT | 68 |
| PR | 37 |
| BR | 16 |
| PC | 5 |
| CJ | 4 |
| TB | 2 |
| M2 | 2 |
| CT | 1 |
| RO | 1 |
| **Total** | **785** |

Esta etapa inclui **somente os 649 registros com unidade de origem `UN`**. Os outros **136** permanecem pendentes porque não existe evidência suficiente para definir automaticamente a unidade operacional de consumo do Atlas.

## Regras preservadas

- `produtos.unidade = 'UN'` somente neste subconjunto, porque a fonte também informa `UN`;
- `unidade_origem = 'UN'` e `qtde_embalagem_origem` preservam a fonte;
- `codigo_origem` preserva o código cru e `codigo` usa normalização segura;
- `origem = 'wvetro'` porque estes registros vêm diretamente da planilha reconciliada;
- `id_externo_wvetro` permanece `NULL`: não existe chave externa distinta do código técnico na fonte entregue;
- `preco = 0` é **placeholder explícito**, pois a fonte não contém preço/custo;
- linha e cor da origem ficam apenas em `dados_origem`; não viram `linha_id`, `cor_id` ou vínculos em `produto_linhas` automaticamente;
- fabricante é preservado em `marca` e no snapshot cru;
- `ncm_origem` guarda o valor cru;
- `ncm` só recebe um valor quando há 8 dígitos e não é placeholder conhecido;
- nenhum NCM é marcado automaticamente como válido: fica `pendente`, ou `invalido` quando claramente placeholder/malformado;
- `status_validacao = 'importado'` para todos os novos itens.

Entre os 649 registros:
- NCM `pendente`: **519**;
- NCM `invalido`: **130**;
- status de origem `ATENCAO`: **501**;
- status de origem `REVISAR`: **130**;
- status de origem `OK`: **18**;
- `Qtde Emb.` diferente de zero: **10**.

Nenhum desses indicadores significa validação técnica automática.

## Guardas da migration

A migration `20260817141000_carga_acessorios_wvetro_un_v1.sql` aborta a transação se:
- a staging não tiver exatamente 649 linhas;
- houver código normalizado duplicado;
- aparecer unidade diferente de `UN`;
- houver item de origem inativo;
- algum código da carga já existir em `produtos` no momento do apply;
- o pós-insert não encontrar exatamente os 649 registros esperados.

## Próximo passo

1. abrir PR desta migration;
2. executar o `Supabase Database Control` em dry-run via PR;
3. confirmar que somente esta migration está pendente e que todas as guardas passam contra a produção atual;
4. somente depois de autorização explícita, aplicar a carga em produção;
5. reauditar a base;
6. tratar separadamente os 136 acessórios com unidade de origem não-UN, sem inventar fator de conversão ou unidade operacional.
''', encoding='utf-8')

blocks = {
    ROOT / 'docs/ai-handoff/CURRENT_STATE.md': f'''\n{MARKER}\n\nA migration de identidade técnica `20260816210000_produtos_identidade_tecnica_v1.sql` está **ativa em produção**. Apply confirmado pelo `Supabase Database Control` run #79 (ID `32037239260`), com `APPLY_PRODUCTION`, etapa de apply concluída e log `Finished supabase db push.`.\n\nCom isso, os campos de identidade/proveniência e `produto_linhas` passam a ser considerados ativos no banco.\n\nPróxima carga preparada em PR separada: `20260817141000_carga_acessorios_wvetro_un_v1.sql`, contendo somente **649 dos 785 acessórios faltantes**, todos com unidade de origem `UN`. Os **136 não-UN** ficam fora até validação da unidade operacional.\n\nA carga não inventa preço/custo, linha técnica, cor técnica, fator de conversão ou ID externo W.Vetro. Preço 0 permanece placeholder explícito por exigência do schema/fonte sem preço. NCM nunca é validado automaticamente.\n''',
    ROOT / 'docs/ai-handoff/NEXT_TASK.md': f'''\n{MARKER}\n\nO gate da identidade técnica foi concluído: `20260816210000_produtos_identidade_tecnica_v1.sql` foi aplicada em produção no run #79 (ID `32037239260`). Não voltar a tratá-la como pendente.\n\nTarefa atual: validar por PR/dry-run `20260817141000_carga_acessorios_wvetro_un_v1.sql`, com **649 acessórios faltantes cuja unidade de origem é UN**. A PR não autoriza apply automático em produção. Após dry-run verde, exigir autorização explícita antes do novo `apply`.\n\nOs **136 faltantes com MT/PR/BR/PC/CJ/TB/M2/CT/RO** permanecem pendentes. Não definir `produtos.unidade` nem fator de conversão para eles sem validação operacional.\n''',
    ROOT / 'docs/ai-handoff/IMPLEMENTATIONS.md': f'''\n{MARKER}\n\n- identidade técnica de produtos aplicada em produção via Supabase Database Control run #79 / ID `32037239260`;\n- campos de proveniência/unidade de origem e tabela `produto_linhas` agora ativos;\n- preparada migration separada para 649 acessórios W.Vetro faltantes com unidade de origem `UN`;\n- 136 faltantes não-UN deliberadamente retidos para validação;\n- sem inferência de preço/custo, linha, cor, conversão ou ID externo.\n''',
}

for path, block in blocks.items():
    text = path.read_text(encoding='utf-8')
    if MARKER not in text:
        if not text.endswith('\n'):
            text += '\n'
        text += block
        path.write_text(text, encoding='utf-8')

print(f'Migration gerada e validada: {MIGRATION} sha256={actual_sha}')
