# Prévia — portas de correr e precificação por peso — 29/10/2026

Branch isolada: `feat/orcamento-portas-homologacao-20261029`. Sem alteração de banco ou publicação em produção.

## Decisões
- Primeiro piloto: Porta de Correr Sequencial (L. Suprema), fórmula marcada como `validada` no banco. Variáveis técnicas e número de folhas continuam selecionáveis; não fixar medidas ou receitas por imagem.
- Perfis e contramarcos: `custo_por_corte = (comprimento_corte_mm / 1000) × peso_kg_m × (preco_kg_aluminio + custo_pintura_kg)`. Quantidade multiplica os cortes; sobra é calculada separadamente por barras do pacote.
- Sem peso, código exato, comprimento ou preço/kg: custo técnico pendente (sem fallback silencioso para valor genérico).
- Acessórios sem custo: exibir como pendência e permitir validação de custo unitário em reais por orçamento. Não salvar automaticamente no catálogo geral.
- Recalcular composição preserva preço manual de acessórios se item, código e unidade não mudarem; perfis continuam calculados por kg.
- Listas de perfis/acessórios devem exibir imagem identificada por produto exato; quando não houver, sinalizar `Imagem pendente`.

## Conferência em banco (somente leitura)
- Configuração atual: alumínio R$ 36,00/kg, adicional de pintura R$ 0,00/kg (pode ser ajustado por regra de negócio), margem padrão 100% (confirmar com Francis para uso comercial).
- 1.895 perfis ativos; 1.647 com peso kg/m no intervalo de validação, 248 pendentes. Há perfis sem medida de barra cadastrada; manter o alerta para otimização de cortes.
- Porta Sequencial Suprema com fórmula validada; outras variantes e tipologias repetidas não ficam aprovadas automaticamente.

## Roteiro obrigatório antes de liberar para clientes
1. Selecionar porta sequencial Suprema, preencher número de folhas, largura, altura, cor e vidro; confirmar desenho e variáveis.
2. Gerar pacote e conferir cada perfil (código, peso por metro, comprimento e quantidade). Confrontar com tabela real de fabricante/W.Vetro, sem inventar componentes.
3. Abrir `/orcamento/{id}/custos-pendentes` pela tela de conferência; validar acessórios sem preço. Confirmar que um perfil sem peso fica bloqueado, sem valor manual.
4. Recalcular e confirmar preservação do custo unitário validado do mesmo acessório, inclusive a soma da quantidade.
5. Conferir plano de corte, barras e sobras recuperáveis; comparar custo produtivo, custo de sobra e sobra cobrada com o orçamento.
6. Ajustar política de margem e sobra, gerar a apresentação para cliente e aprovar somente após conferir o preço final.
7. Verificar imagens de cada perfil e acessório no relatório individual e consolidado. Não usar foto aproximada.

**Status:** tipo e build validados; homologação funcional com orçamento real e autorização de publicação em produção ainda pendentes.