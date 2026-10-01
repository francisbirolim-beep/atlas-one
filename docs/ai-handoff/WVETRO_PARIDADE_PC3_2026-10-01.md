# Paridade W.Vetro × Atlas — Porta de Correr 03 Folhas Suprema

Data da auditoria: 2026-10-01

## Escopo

Esta análise usa casos históricos reais do W.Vetro já preservados no staging Neon. O objetivo é reconstruir a receita técnica no Atlas por evidência, sem inferir regras não demonstradas.

Tipologia Atlas:
- id: `dce9da1d-7e03-4c1c-ad1b-2f101b51a52e`
- W.Vetro: `L. Suprema · Porta De Correr 03 Folhas`

## Regra de segurança

Não promover uma receita completa enquanto houver componentes cuja variável decisória não foi identificada. O motor pode validar o núcleo comprovado isoladamente, mas `SU008` e o corte de contramarco permanecem pendentes.

## Casos usados no self-check

- orçamento 57 — 3100 × 2200 — mão-de-amigo comum, sem reforço de aba;
- orçamento 130 — 1549 × 2105 — comum, com reforço de aba;
- orçamento 1 — 2200 × 2300 — mão-de-amigo larga, com reforço de aba;
- pedido 931 — 2784 × 2202 — reforço externo, reforço de aba e arremate;
- pedido 91 — 2635 × 2150 — CM200, reforço de aba e arremate.

O orçamento 835 (2500 × 2100) foi mantido como evidência, mas é um outlier para diversas medidas e não deve, sozinho, definir a receita genérica.

## Núcleo comprovado para a família PC3 vidro inteiro

### Marco e trilho

- `SU010 = Largura - 30`
- `TMC = SU010`, quantidade 3
- `SU012 = Altura - 4`, quantidade 2

Essas relações se repetem na grande maioria dos casos, inclusive em amostras com CM060/CM200. O orçamento 835 possui descontos diferentes e deve ser tratado como variante/outlier até que sua causa seja identificada.

### Reforço de aba

`SU280 = Altura - 34`, quantidade 2, somente quando o caso possui reforço de aba.

A presença de `SU280`/ `SU280D` é usada na captura histórica como evidência de `reforco_aba = sim`.

### Mão-de-amigo

Códigos observados:

| Perfil | Sem reforço | Reforço interno | Reforço externo | Ambos |
|---|---|---|---|---|
| comum interno | SU040 | SU047 | SU040 | SU047 |
| comum externo | SU041 | SU041 | SU049 | SU049 |
| largo interno | SU243 | SU289 | SU243 | SU289 |
| largo externo | SU242 | SU242 | SU290 | SU290 |

Comprimento do montante para estes casos: `Altura - 34`.

### Travessas e baguetes horizontais

Com mão-de-amigo comum e sem reforço de aba:

`ROUND(((SU010 - 130) / 3) * 100) / 100`

Com mão-de-amigo comum e reforço de aba:

`ROUND(((SU010 - 154.4) / 3) * 100) / 100`

Com mão-de-amigo larga:

`ROUND(((SU010 - 199.2) / 3) * 100) / 100`

Esses tamanhos alimentam `SU053`, `SU225` e `SU102` horizontal.

### Baguete vertical

Nos casos classificados como `pc3_vidro_inteiro`:

`SU102(H) = Altura - 185`

### Arremate face interna

Quando `MP347` existe na família base:

- largura: `Largura + 44`
- altura: `Altura + 22`

O orçamento 835 apresenta +20/+10 e permanece como exceção até identificação da configuração que o diferencia.

### Vidro — família de três folhas de vidro inteiro

Altura:
`Altura - 167`

Largura:
- comum, sem reforço de aba: `CEIL((Largura - 180) / 3)`
- comum, com reforço de aba: `CEIL((Largura - 205) / 3)`
- mão-de-amigo larga: `CEIL((Largura - 250) / 3)`

Quantidade: 3.

## Pendências que bloqueiam uma receita genérica completa

### SU008

O histórico apresenta principalmente `Altura - 17` e `Altura - 21`, além de poucos outliers (ex.: -29/-33). Configurações aparentemente semelhantes aparecem nos dois grupos. Nenhuma variável confiável foi identificada ainda.

Conclusão: não codificar uma regra genérica de `SU008` por aproximação.

### Contramarco CM060 / CM200

Há várias amostras reais com contramarco, inclusive orçamento 835, pedido 91, pedido 586 e outras. Porém, as medidas de corte do próprio contramarco não seguem uma única relação confiável com a largura/altura declarada do item; a convenção de medida de origem precisa ser normalizada antes.

Conclusão: o contramarco pode ser usado como variável de classificação, mas sua fórmula de corte ainda não deve ser promovida.

### Variantes sob o mesmo Modelo W.Vetro

O W.Vetro reutiliza `PORTA DE CORRER 03 FOLHAS` para construções distintas:
- vidro inteiro;
- veneziana;
- bandeira;
- atrás da parede;
- travessa larga;
- registros cujo Nome indica janela.

A captura de casos agora registra `familia_tecnica` e variáveis observadas. Comparações futuras devem considerar a família e não somente Linha + Modelo.

## Implementação local

O self-check `npm run wvetro:paridade:selfcheck` valida o núcleo acima sem depender de banco ou Vercel.

A migration de receita v5 criada antes desta auditoria foi descartada antes de aplicação porque continha hipóteses que os casos históricos mais amplos contradisseram. Nenhuma fórmula de produção foi alterada por esta análise.