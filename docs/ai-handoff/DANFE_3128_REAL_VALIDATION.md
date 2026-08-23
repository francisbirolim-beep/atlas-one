# Validação real — DANFE NF 3128

Validação feita em 2026-08-23 contra o PDF real da NF-e 000.003.128, série 1, emitida em 03/03/2026 por LCT MAZARO IND E COM ARTIGOS SERRALHERIA.

Fonte real da DANFE:
- fornecedor/emitente: LCT MAZARO IND E COM ARTIGOS SERRALHERIA;
- CNPJ emitente: 39.513.137/0001-85;
- total da NF/produtos: R$ 1.403,00;
- chave de acesso: 35260339513137000185550010000031281004278066;
- 5 itens.

Itens reais:
1. AL396PR50 — GUIA DESLIZANTE GOLD PRETO - PACOTE COM 50 PCS — PCT 2 x R$ 30,00 = R$ 60,00.
2. AL395PR50 — GUIA DESLIZANTE GOLD PRETO - TRILHO AT - PACOTE 50 PCS — PCT 2 x R$ 37,50 = R$ 75,00.
3. AL332PR50 — GUIA DESLIZANTE SUPREMA PRETO - PACOTE COM 50 PCS — PCT 8 x R$ 17,50 = R$ 140,00.
4. AL331PR50 — GUIA DESLIZANTE SUPREMA PRETO - TRILHO AT - PACOTE 50 PCS — PCT 4 x R$ 30,00 = R$ 120,00.
5. ALS1 — ROLDANA SUPREMA SIMPLES 100KG - TRILHO CONCAVO — UN 40 x R$ 25,20 = R$ 1.008,00.

Falhas observadas no parser anterior:
- apenas 4 itens identificados; ALS1 ausente;
- soma parcial R$ 395,00 em vez de R$ 1.403,00;
- AL396PR50 contaminado por `PACOTE` no código;
- AL332PR50 e AL331PR50 com hífen indevido;
- descrições quebradas não recompostas integralmente;
- chave de acesso confundida com protocolo `135260...`;
- CNPJ do emitente vazio.

Correção nesta implementação:
- parser V6/V7 reconstrói linhas compactadas, aceita total com separador de milhar e normaliza códigos AL...;
- procura chave de acesso no padrão fiscal e deriva o CNPJ do emitente a partir da chave;
- soma dos itens é confrontada com o valor dos produtos e gera alerta explícito em caso de divergência;
- a prévia continua somente leitura; não atualiza custo nem estoque automaticamente.
