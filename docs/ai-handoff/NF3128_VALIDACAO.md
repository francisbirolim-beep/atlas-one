# Validação real — NF 3128 (LCT Mazaro)

Caso real usado para validar o leitor PDF/DANFE de Compras.

Fonte: DANFE NF-e nº 000.003.128, série 1, emissão 03/03/2026, emitente LCT MAZARO IND E COM ARTIGOS SERRALHERIA, CNPJ 39.513.137/0001-85.

Itens corretos da nota:
1. AL396PR50 — GUIA DESLIZANTE GOLD PRETO - PACOTE COM 50 PCS — PCT 2 x R$ 30,00 = R$ 60,00 — NCM 39259090 — CFOP 5101.
2. AL395PR50 — GUIA DESLIZANTE GOLD PRETO - TRILHO AT - PACOTE 50 PCS — PCT 2 x R$ 37,50 = R$ 75,00 — NCM 39259090 — CFOP 5101.
3. AL332PR50 — GUIA DESLIZANTE SUPREMA PRETO - PACOTE COM 50 PCS — PCT 8 x R$ 17,50 = R$ 140,00 — NCM 39259090 — CFOP 5101.
4. AL331PR50 — GUIA DESLIZANTE SUPREMA PRETO - TRILHO AT - PACOTE 50 PCS — PCT 4 x R$ 30,00 = R$ 120,00 — NCM 39259090 — CFOP 5101.
5. ALS1 — ROLDANA SUPREMA SIMPLES 100KG - TRILHO CONCAVO — UN 40 x R$ 25,20 = R$ 1.008,00 — NCM 83022000 — CFOP 5101.

Total dos produtos: R$ 1.403,00.

Falhas observadas no parser v5 antes da correção:
- reconheceu somente 4 itens, totalizando R$ 395,00;
- contaminou códigos com trechos da descrição: PACOTEAL396PR50, ATAL395PR50, -AL332PR50 e -AL331PR50;
- truncou descrições que continuavam na linha seguinte;
- não reconheceu ALS1 porque o valor total usa separador de milhar (1.008,00);
- CNPJ do emitente permaneceu vazio.

Regra de segurança nova: em PDF/DANFE, quando `valorProdutos` estiver disponível, a confirmação deve ser bloqueada se a soma dos itens não fechar com esse valor (tolerância de R$ 0,02). XML e lançamento manual continuam sujeitos às validações normais; a trava de fechamento aplica-se ao PDF para evitar gravar leitura parcial de DANFE.
