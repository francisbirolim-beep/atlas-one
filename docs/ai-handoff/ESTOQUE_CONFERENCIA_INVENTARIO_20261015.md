# Estoque — conferência, associação e inventário (15/10/2026)

## Regra operacional aprovada para a preparação
- **Não alterar telas, fluxos, saldos, materiais nem custos existentes sem validação.**
- NF-e XML, DANFE/PDF e lançamento manual devem convergir para os mesmos itens de compra. Salvar a NF, por si só, não aumenta estoque.
- A **entrada física** depende da conferência do que chegou: quantidade recebida, avaria, fornecedor e correspondência com o **produto Atlas**.
- Na tela do recebimento, consultar produto vinculado, fator de conversão, saldo físico, reservado e prévia de entrada líquida e saldo posterior, **antes de registrar**.
- Quando não existe saldo cadastrado, exibir **“Não inventariado”**; isso não equivale a estoque físico zero.
- Não cadastrar nem associar produtos automaticamente por descrição semelhante. Exigir confirmação humana; impedir códigos externos de criar produto duplicado. Manter código do fornecedor no vínculo e código interno do Atlas.
- Para **perfis e acessórios**, mostrar foto real do produto; se estiver ausente, destacar pendência de imagem, sem fabricar imagem.
- Uma entrada por NF/recebimento não deve ser contabilizada mais de uma vez. Estoque físico é distinto de reservado e disponível.
- Compras destinadas a uma **obra/cliente** devem manter rastreabilidade e permitir separar/reservar depois da chegada; não duplicar saldo.

## Diagnóstico por leitura em 15/10/2026
- 3.087 produtos cadastrados.
- 1 NF, com 6 itens ainda sem vínculo de produto; 0 recebimentos físicos.
- 0 linhas em `estoque_saldos` e 0 em `estoque_movimentos`.
- Estrutura já instalada: `compras_nfs`, `compras_nf_itens`, `compras_recebimentos`, `compras_recebimento_itens`, `produto_fornecedores`, `estoque_saldos`, `estoque_movimentos`, `estoque_locais`, `estoque_reservas`.
- A rotina `aplicar_estoque_recebimento` já lança quantidade recebida **menos avariada**, multiplicada pelo fator de conversão, no local padrão MATRIZ/GERAL quando há vínculo válido, e retorna pendências caso contrário.
- A antiga tela exibiu aviso desatualizado dizendo que nunca movimentava estoque. A tela precisa refletir o comportamento real.

## Este incremento: prévia sem escrita
- Novo GET `/api/estoque/previsao-recebimento/[nfId]` autenticado e filtrado pela empresa.
- Novo componente na conferência de recebimento para visualizar foto, vínculo, fator, saldo registrado, reservas, entrada útil e projeção.
- Projetar entradas de linhas repetidas do mesmo produto juntas.
- Corrigir o aviso desatualizado da tela.
- **Não altera** `POST /api/compras/recebimentos/[nfId]`, RPC de estoque, banco ou fluxo de lançamento já existente.

## Próxima etapa, isolada: inventário inicial e ajustes
1. Criar contagem física por local e produto, com busca por código e **imagem de perfis/acessórios**, registrando contagem, unidade, data, conferente e observação/foto opcional.
2. Exibir **saldo sistema → contagem → diferença**, sem movimentar estoque durante rascunho.
3. Oferecer correção auditável por divergência (entrada positiva ou saída negativa), exigindo motivo, usuário, aprovação/permissão adequada e referência de inventário.
4. Implantar rotina transacional única com bloqueio concorrente, idempotência por evento, trilha imutável `estoque_movimentos`, consistência `estoque_saldos` e testes de não negatividade/reservas.
5. Separar ajustes de **custo médio** da simples contagem de quantidade; preservar custos técnicos da Engenharia e cálculos aprovados.
6. Registrar o destino físico do recebimento (MATRIZ/GERAL ou local/endereço escolhido), e opcional vínculo à obra/cliente e reserva sem dupla entrada.
7. Tratar diferenças de unidades — metro, barra, peça, caixa, pacote — com fator confirmado e revisável por fornecedor/produto.
8. Revisar o fluxo de erro parcial entre gravação de recebimento e movimentação por item, e garantir retentativa segura, sem duplicar.
9. Exigir teste de regressão de Compras, materiais, produção, vendas, custo, Kanban e balanço; snapshots/rollback e prévia separada antes de publicar.

## Cenários de validação
- Produto existente, fator 1: saldo 8 peças + 4 boas = prévia 12; reserva permanece intacta.
- Produto em duas linhas da mesma NF: prévia agrega as duas quantidades uma vez.
- Barra comprada em caixa: quantidade recebida 2 caixas, fator 6 barras/caixa, 1 barra avariada apenas se recebimento estiver na mesma unidade; conferir regra antes de usar.
- Sem vínculo e/ou conversão: exibir pendência; jamais somar como estoque disponível.
- Sem inventário: exibir estado desconhecido, não atribuir automaticamente saldo 0.
- Repetir recebimento/duplo clique: não gerar movimento duplicado.
- Reabrir NF e consultar prévia: sem alterar saldo, custos nem histórico.
- Produto perfil ou acessório sem foto validada: mostrar pendência de imagem.
- Novo recebimento destinado à obra: manter vínculo e não somar estoque/consumo duas vezes.

**Publicação:** somente após testes e aprovação explícita. Nenhuma migração nem ajuste de estoque executado neste incremento.
