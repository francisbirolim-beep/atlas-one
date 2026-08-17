from pathlib import Path

current = Path('docs/ai-handoff/CURRENT_STATE.md')
impl = Path('docs/ai-handoff/IMPLEMENTATIONS.md')
next_task = Path('docs/ai-handoff/NEXT_TASK.md')

current_marker = '## PRODUTOS — PERFIS W.VETRO — RECONCILIAÇÃO CONCLUÍDA — 2026-08-17'
current_block = '''\n\n## PRODUTOS — PERFIS W.VETRO — RECONCILIAÇÃO CONCLUÍDA — 2026-08-17\n\nFonte real auditada: `ExportWWPerfil (1)(1).xlsx`.\n\nResultado da fonte:\n- 1.307 linhas;\n- 1.307 códigos preenchidos e únicos;\n- 0 duplicados;\n- todos ativos.\n\nSnapshot atual do Atlas exportado em transação PostgreSQL explicitamente `READ ONLY` pelo run `32045643983`:\n- 1.307 perfis;\n- `transaction_read_only = on` confirmado antes do SELECT;\n- nenhuma escrita executada.\n\nReconciliação por código técnico:\n- presentes nos dois lados: **1.307**;\n- faltantes no Atlas: **0**;\n- somente no Atlas: **0**;\n- `EXISTENTE_IGUAL`: **1.235**;\n- `EXISTENTE_FONTE_NAO_PROMOVIDA`: **72**;\n- divergência operacional real: **0**.\n\nOs 72 casos de fonte não promovida são deliberados:\n- 68 registros com `Nome Fabricante = 16` e marca operacional vazia;\n- 4 registros com `NCM = 16` e NCM operacional vazio.\n\nQualidade da fonte que deve permanecer pendente/de origem:\n- 221 NCM placeholders;\n- 18 NCM em formato atípico;\n- 7 tamanhos atípicos (`6` ou `60000`);\n- 2 pesos acima de 50 (`0000000056 = 3462`, `0000000171 = 11538`);\n- 68 fabricantes numéricos `16`;\n- 61 campos `Cod.Barras` preenchidos;\n- 83 valores de sucata não zero.\n\nDecisão: **não inserir novos perfis**. A próxima migration deve apenas enriquecer a proveniência dos 1.307 registros já existentes, preservando integralmente os campos operacionais e mantendo `tamanho_barra_mm` sem promoção automática.\n\nRelatório técnico:\n`docs/tecnico/reconciliacao-exportwwperfil-2026-08-17.md`.\n'''

impl_marker = '## Perfis W.Vetro — auditoria e reconciliação read-only — 2026-08-17'
impl_block = '''\n\n## Perfis W.Vetro — auditoria e reconciliação read-only — 2026-08-17\n\n- recebida a fonte real `ExportWWPerfil (1)(1).xlsx`;\n- fonte auditada: 1.307 códigos únicos;\n- criado export específico de perfis do Atlas com transação `READ ONLY`;\n- snapshot real do Atlas: 1.307 perfis;\n- todos os 1.307 códigos coincidem entre fonte e Atlas;\n- 0 faltantes e 0 exclusivos Atlas;\n- 1.235 correspondências iguais;\n- 72 dados de fonte deliberadamente não promovidos (68 fabricante `16`, 4 NCM `16`);\n- 0 divergências operacionais reais;\n- nenhuma escrita no banco nesta etapa.\n\nRelatório: `docs/tecnico/reconciliacao-exportwwperfil-2026-08-17.md`.\n\nPróxima implementação: migration apenas de proveniência dos 1.307 registros existentes, sem alterar nome, preço/custo, unidade, peso, tamanho operacional, NCM operacional, marca, ativo, linha, cor ou ID externo.\n'''

next_marker = '## TAREFA ATUAL — PROVENIÊNCIA DOS 1.307 PERFIS W.VETRO — 2026-08-17'
next_block = '''## TAREFA ATUAL — PROVENIÊNCIA DOS 1.307 PERFIS W.VETRO — 2026-08-17\n\nA auditoria/reconciliação da fonte `ExportWWPerfil (1)(1).xlsx` está concluída. **Não criar carga de novos perfis**: os 1.307 códigos da fonte já existem no Atlas, sem faltantes e sem exclusivos Atlas.\n\nEstado reconciliado:\n- fonte: 1.307;\n- Atlas: 1.307;\n- códigos correspondentes: 1.307;\n- `EXISTENTE_IGUAL`: 1.235;\n- `EXISTENTE_FONTE_NAO_PROMOVIDA`: 72;\n- divergência operacional real: 0.\n\nPróximo passo:\n1. preparar migration exclusivamente de proveniência para os 1.307 perfis existentes;\n2. gravar os valores crus em `codigo_origem`, `unidade_origem`, `tamanho_barra_mm_origem`, `ncm_origem` e `dados_origem`;\n3. não promover automaticamente `Tamanho` para `tamanho_barra_mm`;\n4. não sobrescrever nome, preço/custo, unidade operacional, peso, NCM operacional, marca, ativo, linha, cor ou ID externo;\n5. incluir guardas transacionais de contagem, IDs/códigos e pós-check de zero alteração operacional;\n6. validar em PR e dry-run;\n7. somente depois de autorização explícita executar `Supabase Database Control` com `APPLY_PRODUCTION`.\n\nFonte com revisão pendente deve permanecer preservada, sem correção por suposição:\n- 221 NCM placeholders;\n- 18 NCM em formato atípico;\n- 7 tamanhos atípicos;\n- 2 pesos muito altos;\n- 68 fabricantes numéricos `16`.\n\nRelatório:\n`docs/tecnico/reconciliacao-exportwwperfil-2026-08-17.md`.\n\nFila secundária permanece:\n- validar humanamente a unidade operacional dos 136 acessórios pendentes;\n- nunca inferir fator de conversão a partir de unidade/embalagem da fonte.\n\n'''

text = current.read_text()
if current_marker not in text:
    current.write_text(text.rstrip() + current_block, encoding='utf-8')

text = impl.read_text()
if impl_marker not in text:
    impl.write_text(text.rstrip() + impl_block, encoding='utf-8')

text = next_task.read_text()
if next_marker not in text:
    title, rest = text.split('\n', 1)
    next_task.write_text(title + '\n\n' + next_block + rest.lstrip(), encoding='utf-8')
