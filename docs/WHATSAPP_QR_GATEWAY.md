# WhatsApp QR Gateway — Atlas One

## Arquitetura

O Atlas usa o WhatsApp Business existente como dispositivo vinculado via QR Code.
O processo persistente roda fora do Vercel e mantém a conexão WebSocket com o WhatsApp.
No ambiente atual, o gateway roda no Mac da Esquadrifácio.

- Atlas/Vercel: interface, autenticação, fila e APIs.
- Supabase: conversas, mensagens, auditoria, roteamento e estado do gateway.
- Mac Gateway: sessão WhatsApp Multi-Device, QR, recebimento e envio.
- Sessão local: `~/.atlas-one/whatsapp-session`.
- Segredo local: `~/.atlas-one/whatsapp-gateway.env` (permissão 600).

## Inicialização

```bash
npm run whatsapp:gateway
```

A tela `/whatsapp/configuracao` mostra o QR Code para o Master.

No WhatsApp Business do número principal:

1. Configurações
2. Aparelhos conectados
3. Conectar aparelho
4. Escanear o QR exibido pelo Atlas

Depois do primeiro vínculo, a sessão é persistida localmente e o QR só volta a ser necessário se o dispositivo for desconectado/logado para fora.

## Segurança

O Mac não recebe a chave administrativa do Supabase.
O gateway usa um token dedicado; apenas o SHA-256 desse token fica no banco.
Mensagens e eventos permanecem no histórico append-only do Atlas.

## Observação operacional

A integração QR usa o protocolo WhatsApp Web Multi-Device através do Baileys e não é a Cloud API oficial da Meta. Deve ser mantida em um processo persistente e monitorado.
