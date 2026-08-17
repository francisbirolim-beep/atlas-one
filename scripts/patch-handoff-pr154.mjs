import fs from 'node:fs'

const files = {
  current: 'docs/ai-handoff/CURRENT_STATE.md',
  next: 'docs/ai-handoff/NEXT_TASK.md',
  impl: 'docs/ai-handoff/IMPLEMENTATIONS.md',
}

const marker = '## CADASTRO — CATEGORIAS DINÂMICAS DE PRODUTOS — PR #154'

function appendOnce(path, block) {
  let src = fs.readFileSync(path, 'utf8')
  if (src.includes(marker)) return
  if (!src.endsWith('\n')) src += '\n'
  src += `\n${block.trim()}\n`
  fs.writeFileSync(path, src)
}

appendOnce(files.current, `
${marker}

PR #154 — **mergeada** em 2026-08-17.

Commit de merge:
\`a4ae49e58ddd6317e903dfee1e032a8b8694a5f4\`

Estado ativo:
- a tela principal \`Cadastro\` mostra as categorias de produto diretamente, em vez de um único acesso genérico a Produtos;
- categorias principais: \`Produto\`, \`Acessório\`, \`Perfil\` e \`Produto pronto\`;
- o usuário master pode criar outras categorias pelo botão \`Nova categoria\`;
- categorias personalizadas são persistidas em \`configuracoes_gerais\`;
- clicar numa categoria abre \`/cadastro/produtos\` já filtrado por ela;
- cadastro e edição de produtos usam a lista dinâmica de categorias;
- categorias legadas já usadas por produtos são preservadas e continuam aparecendo, sem recategorização automática;
- filtro por Linha continua combinado com categoria e busca textual.

Sem migration e sem alteração de schema: \`produtos.categoria\` já é texto livre.
`)

appendOnce(files.next, `
${marker}

A PR #154 já foi mergeada no commit \`a4ae49e58ddd6317e903dfee1e032a8b8694a5f4\`.

Não voltar a fixar \`CategoriaProduto\` em um union fechado nem reintroduzir a lista hardcoded como fonte operacional. Categorias novas devem continuar sendo criáveis pelo usuário e categorias legadas em uso devem permanecer visíveis.

Importante: nenhum produto existente foi recategorizado automaticamente por esta implementação.

O gate principal de produtos permanece separado: a migration \`20260816210000_produtos_identidade_tecnica_v1.sql\` continua dependendo de apply explícito em produção.
`)

appendOnce(files.impl, `
${marker}

Mergeada em 2026-08-17 no commit \`a4ae49e58ddd6317e903dfee1e032a8b8694a5f4\`.

- categorias de produto passaram de lista fixa para configuração dinâmica;
- Cadastro exibe Produto, Acessório, Perfil e Produto pronto separadamente;
- botão Nova categoria permite expansão sem código/migration;
- categorias customizadas são armazenadas em \`configuracoes_gerais\`;
- tela Produtos abre filtrada pela categoria escolhida e mantém filtro por linha/busca;
- categorias legadas e produtos existentes são preservados sem movimentação automática;
- sem migration/schema change.
`)

console.log('Handoff PR #154 atualizado.')
