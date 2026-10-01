import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const headers = { "content-type": "application/json; charset=utf-8" };
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}
function normalizePhone(value: unknown) {
  const n = digits(value);
  if (!n) return "";
  return n.startsWith("55") ? n : `55${n}`;
}
function phoneFromJid(value: unknown) {
  const raw = String(value ?? "");
  const left = raw.split("@")[0] || "";
  return normalizePhone(left.split(":")[0] || "");
}
function atlasMessageType(value: unknown) {
  const tipo = String(value || "text").toLowerCase();
  const mapa: Record<string,string> = {
    text: "texto",
    texto: "texto",
    image: "imagem",
    imagem: "imagem",
    sticker: "imagem",
    audio: "audio",
    video: "video",
    document: "documento",
    documento: "documento",
    location: "localizacao",
    localizacao: "localizacao",
    contact: "contato",
    contato: "contato",
    reaction: "reacao",
    reacao: "reacao",
    system: "sistema",
    sistema: "sistema",
  };
  return mapa[tipo] || "sistema";
}
const MEDIA_BUCKET = "whatsapp-midia";
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const MIME_MEDIA = new Set([
  "image/jpeg","image/png","image/webp","image/heic",
  "video/mp4","video/quicktime",
  "audio/webm","audio/mp4","audio/mpeg","audio/ogg","audio/opus","audio/aac",
  "application/pdf","text/plain","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function mediaMime(value: unknown) {
  return String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
}
function safeFileName(value: unknown) {
  const raw = String(value || "arquivo").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "arquivo";
}
function validateMedia(mimeValue: unknown, sizeValue: unknown) {
  const mime = mediaMime(mimeValue);
  const size = Number(sizeValue || 0);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Arquivo de midia invalido.");
  if (size > MEDIA_MAX_BYTES) throw new Error("Arquivo de midia excede 50 MB.");
  if (!MIME_MEDIA.has(mime)) throw new Error("Tipo de arquivo nao permitido.");
  return { mime, size };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function authenticate(req: Request) {
  const token = req.headers.get("x-atlas-gateway-token")?.trim() || "";
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await db
    .from("atendimento_configuracoes")
    .select("*")
    .eq("gateway_token_hash", hash)
    .eq("ativo", true)
    .eq("modo_integracao", "qr")
    .maybeSingle();
  return data;
}
async function getChannel(empresaId: string, channelId: string) {
  if (!channelId) return null;
  const { data } = await db
    .from("atendimento_whatsapp_canais")
    .select("*")
    .eq("id", channelId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  return data;
}
async function userName(userId: string | null) {
  if (!userId) return null;
  const { data } = await db.from("usuarios").select("nome").eq("id", userId).maybeSingle();
  return data?.nome || null;
}
async function customerByPhone(empresaId: string, telefone: string) {
  const { data } = await db
    .from("clientes")
    .select("id,nome,whatsapp,telefone")
    .eq("empresa_id", empresaId)
    .limit(1500);
  const target = normalizePhone(telefone);
  return (data || []).find((c: any) =>
    normalizePhone(c.whatsapp) === target || normalizePhone(c.telefone) === target
  ) || null;
}
async function routingRule(empresaId: string, texto: string | null) {
  const { data } = await db
    .from("atendimento_regras_roteamento")
    .select("prioridade,palavras_chave,setor,usuario_id")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("prioridade", { ascending: true });
  const normalized = (texto || "").toLocaleLowerCase("pt-BR");
  return (data || []).find((r: any) => {
    const words = Array.isArray(r.palavras_chave) ? r.palavras_chave : [];
    return words.length === 0 ||
      words.some((w: string) => normalized.includes(w.toLocaleLowerCase("pt-BR")));
  }) || null;
}
async function openSession(conversation: any) {
  const { data: existing } = await db
    .from("atendimento_sessoes")
    .select("*")
    .eq("conversa_id", conversation.id)
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await db.from("atendimento_sessoes").insert({
    empresa_id: conversation.empresa_id,
    conversa_id: conversation.id,
    status: conversation.responsavel_id ? "em_atendimento" : "aguardando",
    responsavel_id: conversation.responsavel_id || null,
    responsavel_nome: conversation.responsavel_nome || null,
    setor: conversation.setor || null,
    assigned_at: conversation.responsavel_id ? new Date().toISOString() : null,
  }).select("*").single();
  if (error) throw error;
  return data;
}
async function appendEvent(
  empresaId: string,
  conversaId: string,
  tipo: string,
  dados: Record<string, unknown>,
  sessaoId?: string | null,
) {
  const { error } = await db.from("atendimento_eventos").insert({
    empresa_id: empresaId,
    conversa_id: conversaId,
    sessao_id: sessaoId || null,
    tipo,
    dados,
  });
  if (error) throw error;
}
async function conversationForInbound(config: any, channel: any, telefone: string, nome: string | null, texto: string | null) {
  const { data: existing } = await db
    .from("atendimento_conversas")
    .select("*")
    .eq("empresa_id", config.empresa_id)
    .eq("canal", "whatsapp")
    .eq("whatsapp_canal_id", channel.id)
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customer = await customerByPhone(config.empresa_id, telefone);

  let ownerId = channel.usuario_id || null;
  let sector = null;
  if (!ownerId && channel.principal) {
    const rule = await routingRule(config.empresa_id, texto);
    ownerId = rule?.usuario_id || config.usuario_padrao_id || null;
    sector = rule?.setor || config.setor_padrao || null;
  }
  const ownerName = await userName(ownerId);

  if (existing) {
    const keepExistingOwner = existing.responsavel_id || ownerId;
    const keepExistingOwnerName = existing.responsavel_nome || (
      keepExistingOwner === ownerId ? ownerName : await userName(keepExistingOwner)
    );
    const { data, error } = await db.from("atendimento_conversas").update({
      contato_nome: nome || customer?.nome || existing.contato_nome || null,
      cliente_id: customer?.id || existing.cliente_id || null,
      whatsapp_canal_id: channel.id,
      whatsapp_numero: channel.numero_declarado,
      responsavel_id: keepExistingOwner,
      responsavel_nome: keepExistingOwnerName,
      setor: existing.setor || sector || null,
      status: keepExistingOwner ? "em_atendimento" : "aguardando",
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await db.from("atendimento_conversas").insert({
    empresa_id: config.empresa_id,
    canal: "whatsapp",
    telefone,
    contato_nome: nome || customer?.nome || null,
    cliente_id: customer?.id || null,
    whatsapp_canal_id: channel.id,
    whatsapp_numero: channel.numero_declarado,
    status: ownerId ? "em_atendimento" : "aguardando",
    responsavel_id: ownerId,
    responsavel_nome: ownerName,
    setor: sector,
  }).select("*").single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const config = await authenticate(req);
    if (!config) return reply({ error: "Gateway nao autorizado." }, 401);

    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("mode") === "channels") {
      const { data, error } = await db
        .from("atendimento_whatsapp_canais")
        .select("id,nome,numero_declarado,numero_conectado,tipo_conta,principal,usuario_id,usuario_nome,ativo,session_slug,gateway_status,nivel_hierarquia,criado_por,criado_por_nome")
        .eq("empresa_id", config.empresa_id)
        .eq("ativo", true)
        .order("principal", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return reply({ ok: true, channels: data || [] });
    }

    const channelId = url.searchParams.get("channelId") || "";
    if (req.method === "GET") {
      const channel = await getChannel(config.empresa_id, channelId);
      if (!channel) return reply({ error: "Canal nao encontrado." }, 404);

      const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
      await db.from("atendimento_fila_saida").update({
        status: "pendente",
        processando_em: null,
        updated_at: new Date().toISOString(),
      })
        .eq("empresa_id", config.empresa_id)
        .eq("whatsapp_canal_id", channel.id)
        .eq("status", "processando")
        .lt("processando_em", staleBefore);

      const { data: item, error } = await db
        .from("atendimento_fila_saida")
        .select("id,conversa_id,mensagem_id,telefone,tipo,texto,payload,tentativas,created_at")
        .eq("empresa_id", config.empresa_id)
        .eq("whatsapp_canal_id", channel.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!item) return reply({ ok: true, item: null });

      const { error: lockError } = await db.from("atendimento_fila_saida").update({
        status: "processando",
        tentativas: Number(item.tentativas || 0) + 1,
        processando_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).eq("status", "pendente");
      if (lockError) throw lockError;

      const payload = item.payload && typeof item.payload === "object"
        ? { ...item.payload } as Record<string, unknown>
        : {};
      const mediaPath = typeof payload.mediaPath === "string" ? payload.mediaPath : "";
      if (mediaPath) {
        const { data: signed, error: signedError } = await db.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(mediaPath, 10 * 60);
        if (signedError || !signed?.signedUrl) {
          await db.from("atendimento_fila_saida").update({
            status: "erro",
            erro: signedError?.message || "Falha ao gerar URL temporaria da midia.",
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          throw signedError || new Error("Falha ao gerar URL temporaria da midia.");
        }
        payload.mediaUrl = signed.signedUrl;
      }

      return reply({ ok: true, item: { ...item, payload } });
    }

    if (req.method !== "POST") return reply({ error: "Metodo invalido." }, 405);
    const body = await req.json();
    const type = String(body?.type || "");
    const bodyChannelId = String(body?.channelId || "");
    const channel = await getChannel(config.empresa_id, bodyChannelId);
    if (!channel) return reply({ error: "Canal nao encontrado." }, 404);

    if (type === "media_prepare") {
      const { mime, size } = validateMedia(body.mimeType, body.size);
      const name = safeFileName(body.fileName || `midia-${Date.now()}`);
      const month = new Date().toISOString().slice(0, 7);
      const reference = safeFileName(body.whatsappMessageId || channel.id);
      const path = `${config.empresa_id}/entrada/${month}/${reference}/${crypto.randomUUID()}-${name}`;

      const { data, error } = await db.storage
        .from(MEDIA_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data?.token) throw error || new Error("Falha ao preparar upload da midia.");

      return reply({
        ok: true,
        path,
        token: data.token,
        signedUrl: data.signedUrl,
        mimeType: mime,
        size,
      });
    }

    if (type === "state") {
      const now = new Date().toISOString();
      const connectedNumber = body.connectedJid ? phoneFromJid(body.connectedJid) : null;
      const declared = normalizePhone(channel.numero_declarado);
      const mismatch = body.status === "connected" &&
        connectedNumber &&
        declared &&
        connectedNumber !== declared;
      const status = mismatch ? "mismatch" : String(body.status || "offline");

      const payload: Record<string, unknown> = {
        gateway_status: status,
        gateway_last_seen_at: now,
        gateway_device_name: body.deviceName || channel.gateway_device_name || "Atlas One Gateway",
        updated_at: now,
      };
      if (status === "qr") {
        payload.gateway_qr_data_url = body.qrDataUrl || null;
        payload.gateway_qr_updated_at = now;
      }
      if (body.status === "connected") {
        payload.gateway_qr_data_url = null;
        payload.gateway_connected_jid = body.connectedJid || null;
        payload.numero_conectado = connectedNumber || null;
        if (!declared && connectedNumber) payload.numero_declarado = connectedNumber;
      }

      const { error } = await db
        .from("atendimento_whatsapp_canais")
        .update(payload)
        .eq("id", channel.id);
      if (error) throw error;

      return reply({
        ok: true,
        accepted: !mismatch,
        status,
        expectedNumber: declared || null,
        connectedNumber,
      });
    }

    if (type === "inbound") {
      const telefone = normalizePhone(body.telefone);
      if (!telefone) return reply({ error: "Telefone invalido." }, 400);

      if (body.whatsappMessageId) {
        const { data: duplicate } = await db
          .from("atendimento_mensagens")
          .select("id")
          .eq("empresa_id", config.empresa_id)
          .eq("whatsapp_message_id", body.whatsappMessageId)
          .maybeSingle();
        if (duplicate) return reply({ ok: true, duplicate: true });
      }

      const conversation = await conversationForInbound(
        config,
        channel,
        telefone,
        body.contatoNome || null,
        body.texto || null,
      );
      const session = await openSession(conversation);
      const now = body.timestamp || new Date().toISOString();
      const text = body.texto || "[Mensagem]";

      const { error: msgError } = await db.from("atendimento_mensagens").insert({
        empresa_id: config.empresa_id,
        conversa_id: conversation.id,
        sessao_id: session?.id || null,
        direcao: "entrada",
        tipo: atlasMessageType(body.messageType),
        texto: text,
        media_url: body.mediaPath || null,
        mime_type: body.mimeType ? mediaMime(body.mimeType) : null,
        whatsapp_message_id: body.whatsappMessageId || null,
        provider_timestamp: now,
        payload: {
          transporte: "qr_gateway",
          whatsapp_canal_id: channel.id,
          whatsapp_numero: channel.numero_declarado,
          fileName: body.fileName || null,
          mediaSize: Number(body.mediaSize || 0) || null,
          ...(body.payload || {}),
        },
      });
      if (msgError) throw msgError;

      const { error: convError } = await db.from("atendimento_conversas").update({
        ultimo_preview: text,
        nao_lidas: Number(conversation.nao_lidas || 0) + 1,
        ultima_mensagem_em: now,
        ultima_entrada_em: now,
        status: conversation.responsavel_id ? "em_atendimento" : "aguardando",
        updated_at: new Date().toISOString(),
      }).eq("id", conversation.id);
      if (convError) throw convError;

      await appendEvent(
        config.empresa_id,
        conversation.id,
        "mensagem_recebida_qr",
        {
          whatsapp_message_id: body.whatsappMessageId || null,
          tipo: body.messageType || "text",
          whatsapp_canal_id: channel.id,
          whatsapp_numero: channel.numero_declarado,
        },
        session?.id || null,
      );

      return reply({ ok: true, duplicate: false, conversaId: conversation.id });
    }

    if (type === "sent") {
      const { data: queue, error: queueReadError } = await db
        .from("atendimento_fila_saida")
        .select("id,conversa_id,mensagem_id,whatsapp_canal_id")
        .eq("id", body.filaId)
        .eq("empresa_id", config.empresa_id)
        .eq("whatsapp_canal_id", channel.id)
        .maybeSingle();
      if (queueReadError) throw queueReadError;
      if (!queue) return reply({ error: "Item da fila nao encontrado." }, 404);

      const success = body.sucesso === true;
      const now = new Date().toISOString();
      const { error: queueError } = await db.from("atendimento_fila_saida").update({
        status: success ? "enviado" : "erro",
        erro: success ? null : (body.erro || "Falha no envio pelo gateway."),
        enviado_em: success ? now : null,
        updated_at: now,
      }).eq("id", queue.id);
      if (queueError) throw queueError;

      if (success && queue.mensagem_id) {
        await db.from("atendimento_mensagens").update({
          whatsapp_message_id: body.whatsappMessageId || null,
          provider_timestamp: now,
        })
          .eq("id", queue.mensagem_id)
          .eq("empresa_id", config.empresa_id);
      }

      await appendEvent(
        config.empresa_id,
        queue.conversa_id,
        success ? "mensagem_enviada_qr" : "mensagem_erro_qr",
        {
          fila_id: queue.id,
          mensagem_id: queue.mensagem_id,
          whatsapp_message_id: body.whatsappMessageId || null,
          whatsapp_canal_id: channel.id,
          erro: body.erro || null,
        },
      );
      return reply({ ok: true });
    }

    return reply({ error: "Evento invalido." }, 400);
  } catch (error) {
    console.error(error);
    return reply(
      { error: error instanceof Error ? error.message : "Falha no gateway." },
      500,
    );
  }
});