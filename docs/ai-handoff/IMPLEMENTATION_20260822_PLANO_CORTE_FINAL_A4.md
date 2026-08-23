# Plano de Corte final A4 — 2026-08-22

## Estado

Implementado e aprovado visualmente pelo usuário para publicação.

## Entregue

- cabeçalho white-label usa `dados_empresa`: logo, nome/nome fantasia e cor principal da empresa cadastrada no Atlas;
- `Ambiente / localização` aparece no formulário e no relatório;
- layout usa toda a largura útil da folha e mantém cabeçalho, dados do cliente, tipologia, seletores, tabelas e quadro de vidro alinhados na mesma reta;
- impressão configurada para A4 retrato com margem de 4 mm e tipografia compacta;
- Perfis / Plano de Corte e Acessórios / Consumíveis aparecem lado a lado no mesmo relatório;
- perfis usam `imagem_url` real já resolvida pelo Plano de Corte;
- acessórios procuram a `foto_url` do produto cadastrado pelo código; sem imagem cadastrada exibem `—`;
- quantidades dos acessórios são calculadas com `calcularAcessoriosTecnicos`; itens sem fórmula usam `quantidade_referencia`, sem inventar regra;
- cores de perfil e acessório ganharam seletores com Preto, Branco, Amadeirado, Corten e Outra Cor;
- vidro ganhou seletor com Temperado 6 mm, 8 mm, 10 mm, Laminado 4+4 e também opções vindas do cadastro de vidros;
- quadro de vidro usa toda a largura do relatório e mostra composição, quantidade, largura, altura, área e ambiente;
- representação frontal simples da tipologia é gerada pela quantidade de folhas para identificação visual; não substitui desenho técnico de produção;
- nenhuma fórmula de perfil foi alterada nesta implementação.

## Dependências integradas antes desta etapa

- PR #234 — Editor de Acessórios e fórmulas PC2–PC4;
- PR #235 — Ambiente + identidade white-label do Plano de Corte.

## Validação automática

- `next build` concluído com sucesso no preview Vercel do commit `aa4a2bc871382c3d4dde6eb77bf29cf8a275cf6a`;
- Vercel marcou o deployment como `READY`.

## Validação operacional seguinte

Testar impressão real de PC2, PC3 e PC4 Suprema em 2000 x 2100 e confirmar que todas as linhas permanecem em uma única folha A4. Configurações com quantidade excepcionalmente alta de componentes devem ser avaliadas caso a caso, sem esconder linhas técnicas para forçar uma página.
