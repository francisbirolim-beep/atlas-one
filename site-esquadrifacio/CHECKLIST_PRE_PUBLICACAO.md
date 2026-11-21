# Verificação de pré-publicação — Esquadrifácio®

Atualizado em 19/10/2026. Documento operacional. **Não autoriza publicação nem mudanças de DNS.**

## Estado e responsabilidade

- Site aprovado visualmente: versão clara premium, imagens autorizadas, marca ® e fotos originais inalteradas.
- Hospedagem de homologação: projeto independente `esquadrifacio-site-preview` na Vercel, protegido por autenticação e marcado `noindex,nofollow`.
- Publicação oficial: **não realizada**. O endereço `esquadrifacio.com.br` continua atendido pela Hostinger.
- Contatos confirmados: WhatsApp (17) 99636-1318, Instagram `@esquadrifacio`, localização enviada pelo proprietário.
- Bloqueios atuais: `fotos_autorizadas=true`; `dominio_controlado=true` (apenas administração identificada no hPanel); `privacidade_revisada=false`; `publicacao_autorizada=false`.

## Aceite visual e funcional

1. Abrir na largura de celular (360–430 px), tablet (768 px) e desktop (1280–1440 px). Confirmar legibilidade, ausência de rolagem horizontal e que a marca ® aparece corretamente.
2. Verificar a foto principal, as três soluções da homepage e o portfólio. Cada imagem deve ser autêntica e corresponder ao arquivo aprovado no manifesto.
3. Clicar nos cartões da homepage: painéis e ripados -> `solucoes.html#ripados`, portas de entrada -> `#entradas`, esquadrias de vidro -> `#fachadas`.
4. Verificar que a página de soluções possui nove categorias e que o retorno à homepage funciona.
5. Abrir WhatsApp, Instagram e “Como chegar” a partir do computador e celular. Não enviar mensagens ou publicar postagens automaticamente.
6. Ler e aprovar separadamente a política de privacidade; até então, manter a indicação de revisão e `privacidade_revisada=false`.
7. Confirmar navegação por teclado, foco visível e visualização das oito fotos em conexão móvel.

## Preparação técnica para o domínio

1. Registrar os dados completos da zona DNS **imediatamente antes** da troca: todos os A/ALIAS/CNAME, MX, TXT, SPF, DKIM, DMARC, autodiscover/autoconfig, TTL e nameservers.
2. Confirmar em qual provedor está o site anterior e guardar o processo exato para restaurar o ALIAS/CNAME vigente. O ALIAS raiz visto no hPanel inclui a grafia `equifacio.com.br.cdn.hstgr.net`; **não corrigi-lo por presunção**.
3. Manter nameservers `ns1.dns-parking.com` e `ns2.dns-parking.com` enquanto houver e-mail na Hostinger; não usar “Redefinir registros DNS”.
4. Somente após aprovação expressa, adicionar raiz e `www` ao projeto público separado da Vercel e utilizar os valores exatos que a plataforma indicar **naquele momento**, sem interferir no projeto Atlas.
5. Preparar a versão pública usando o gerador do repositório, que exige os quatro controles de autorização e calcula canonical, mapa do site, metadados sociais e dados estruturados.
6. Após o corte, validar HTTPS, domínio raiz, `www`, WhatsApp, Instagram, Google Maps, imagens e os registros de e-mail. Realizar teste real de envio e recebimento com o responsável.
7. Se houver regressão, restaurar os **valores web originais completos** do backup, sem alterar os registros de e-mail.

## Ações proibidas sem autorização

- Não modificar DNS, MX, TXT, nameservers ou domínio do Atlas.
- Não fazer merge da PR #897 com a aplicação do ERP para publicar o site.
- Não desabilitar autenticação nem `noindex` no ambiente de homologação.
- Não presumir aprovação legal da política nem autorização para troca definitiva do site a partir de uma aprovação visual.
