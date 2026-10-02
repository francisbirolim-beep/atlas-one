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
function categoriaPreferida(preferencias: any, categoria: string) {
  if (categoria === "tarefas") return preferencias?.tarefas !== false;
  if (categoria === "agenda") return preferencias?.agenda !== false;
  if (categoria === "chat") return preferencias?.chat !== false;
  return preferencias?.operacao !== false;
}

function horarioLocal(timeZone: string) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hora = Number(partes.find((p) => p.type === "hour")?.value || 0);
  const minuto = Number(partes.find((p) => p.type === "minute")?.value || 0);
  return hora * 60 + minuto;
}

function minutosHorario(valor: unknown) {
  const [h, m] = String(valor || "00:00").split(":");
  return Number(h || 0) * 60 + Number(m || 0);
}

function estaEmNaoPerturbe(preferencias: any) {
  if (!preferencias?.nao_perturbe_ativo) return false;
  const agora = horarioLocal(preferencias.timezone || "America/Sao_Paulo");
  const inicio = minutosHorario(preferencias.nao_perturbe_inicio || "22:00");
  const fim = minutosHorario(preferencias.nao_perturbe_fim || "07:00");
  if (inicio === fim) return true;
  return inicio < fim ? agora >= inicio && agora < fim : agora >= inicio || agora < fim;
}

async function destinatariosWhatsApp(config: any, channel: any, conversation: any) {
  const ids = new Set<string>();
  if (conversation.responsavel_id) {
    ids.add(conversation.responsavel_id);
    return [...ids];
  }
  if (channel.usuario_id) ids.add(channel.usuario_id);

  const [{ data: masters }, { data: permissoes }] = await Promise.all([
    db.from("usuarios")
      .select("id")
      .eq("empresa_id", config.empresa_id)
      .eq("role", "master"),
    db.from("atendimento_whatsapp_permissoes")
      .select("usuario_id,pode_atender,pode_supervisionar")
      .eq("empresa_id", config.empresa_id)
      .eq("canal_id", channel.id),
  ]);

  for (const u of masters || []) if (u.id) ids.add(u.id);
  for (const p of permissoes || []) {
    if (p.usuario_id && (p.pode_atender || p.pode_supervisionar)) ids.add(p.usuario_id);
  }
  return [...ids];
}

async function notificarMensagemWhatsApp(config: any, channel: any, conversation: any, body: any, text: string) {
  const recipients = await destinatariosWhatsApp(config, channel, conversation);
  if (!recipients.length) return;

  const originId = `${channel.id}:${body.whatsappMessageId || crypto.randomUUID()}`;
  const titulo = `WhatsApp · ${conversation.contato_nome || conversation.telefone}`;
  const mensagem = String(text || "Nova mensagem").slice(0, 500);

  const rows = recipients.map((usuarioId) => ({
    empresa_id: config.empresa_id,
    usuario_id: usuarioId,
    categoria: "chat",
    tipo: "whatsapp_mensagem",
    titulo,
    mensagem,
    href: `/whatsapp?conversaId=${conversation.id}`,
    origem_tipo: "whatsapp_mensagem",
    origem_id: originId,
    push_status: "pendente",
  }));

  for (const row of rows) {
    const { error } = await db.from("notificacoes").insert(row);
    if (error && error.code !== "23505") {
      console.error("Falha ao criar notificacao WhatsApp:", error.message);
    }
  }
}

async function proximaNotificacaoPush(config: any) {
  const limiteTravado = new Date(Date.now() - 5 * 60_000).toISOString();
  await db.from("notificacoes").update({
    push_status: "pendente",
    push_erro: "Reprocessada apos timeout do worker.",
  })
    .eq("empresa_id", config.empresa_id)
    .eq("push_status", "processando")
    .lt("push_ultimo_em", limiteTravado);

  const { data: notificacao, error } = await db.from("notificacoes")
    .select("id,usuario_id,categoria,tipo,titulo,mensagem,href,created_at,push_tentativas")
    .eq("empresa_id", config.empresa_id)
    .eq("push_status", "pendente")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!notificacao) return null;

  const agora = new Date().toISOString();
  const { error: lockError } = await db.from("notificacoes").update({
    push_status: "processando",
    push_tentativas: Number(notificacao.push_tentativas || 0) + 1,
    push_ultimo_em: agora,
    push_erro: null,
  }).eq("id", notificacao.id).eq("push_status", "pendente");
  if (lockError) throw lockError;

  const [{ data: preferencias }, { data: assinaturas }] = await Promise.all([
    db.from("notificacao_preferencias").select("*").eq("usuario_id", notificacao.usuario_id).maybeSingle(),
    db.from("notificacao_push_assinaturas")
      .select("id,endpoint,p256dh,auth,dispositivo_nome")
      .eq("usuario_id", notificacao.usuario_id)
      .eq("empresa_id", config.empresa_id)
      .eq("ativo", true),
  ]);

  if (preferencias?.push_ativo === false || !categoriaPreferida(preferencias, notificacao.categoria)) {
    await db.from("notificacoes").update({
      push_status: "ignorado",
      push_erro: preferencias?.push_ativo === false ? "Push desativado pelo usuario." : "Categoria silenciada pelo usuario.",
      push_ultimo_em: agora,
    }).eq("id", notificacao.id);
    return { skipped: true };
  }

  if (!assinaturas?.length) {
    await db.from("notificacoes").update({
      push_status: "ignorado",
      push_erro: "Nenhum dispositivo inscrito para Web Push.",
      push_ultimo_em: agora,
    }).eq("id", notificacao.id);
    return { skipped: true };
  }

  const silent = preferencias?.som_ativo !== true || estaEmNaoPerturbe(preferencias);
  return {
    notificacao: { ...notificacao, silent },
    assinaturas,
  };
}

async function confirmarNotificacaoPush(config: any, body: any) {
  const notificationId = String(body.notificationId || "");
  if (!notificationId) throw new Error("Notificacao de push nao informada.");

  const { data: notificacao } = await db.from("notificacoes")
    .select("id,push_tentativas")
    .eq("id", notificationId)
    .eq("empresa_id", config.empresa_id)
    .maybeSingle();
  if (!notificacao) throw new Error("Notificacao de push nao encontrada.");

  const resultados = Array.isArray(body.resultados) ? body.resultados : [];
  let sucessos = 0;
  for (const resultado of resultados) {
    const assinaturaId = String(resultado?.assinaturaId || "");
    if (!assinaturaId) continue;
    if (resultado?.sucesso === true) {
      sucessos += 1;
      await db.from("notificacao_push_assinaturas").update({
        erro_count: 0,
        ultimo_erro: null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", assinaturaId).eq("empresa_id", config.empresa_id);
    } else {
      const statusCode = Number(resultado?.statusCode || 0);
      const expirada = statusCode === 404 || statusCode === 410;
      const { data: atual } = await db.from("notificacao_push_assinaturas")
        .select("erro_count")
        .eq("id", assinaturaId)
        .eq("empresa_id", config.empresa_id)
        .maybeSingle();
      await db.from("notificacao_push_assinaturas").update({
        ativo: expirada ? false : true,
        erro_count: Number(atual?.erro_count || 0) + 1,
        ultimo_erro: String(resultado?.erro || `HTTP ${statusCode || "?"}`).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", assinaturaId).eq("empresa_id", config.empresa_id);
    }
  }

  const tentativas = Number(notificacao.push_tentativas || 0);
  const status = sucessos > 0 ? "enviado" : tentativas < 3 ? "pendente" : "erro";
  await db.from("notificacoes").update({
    push_status: status,
    push_enviado_em: sucessos > 0 ? new Date().toISOString() : null,
    push_erro: sucessos > 0 ? null : "Nao foi possivel entregar o push em nenhum dispositivo.",
    push_ultimo_em: new Date().toISOString(),
  }).eq("id", notificationId).eq("empresa_id", config.empresa_id);

  return { ok: true, status, sucessos };
}

async function syncContacts(config: any, channel: any, rawContacts: any[]) {
  const now = new Date().toISOString();
  const contacts = (Array.isArray(rawContacts) ? rawContacts : [])
    .map((item: any) => {
      const jid = String(item?.id || item?.jid || "").trim();
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return null;
      const telefone = phoneFromJid(jid);
      if (!telefone) return null;
      return {
        empresa_id: config.empresa_id,
        whatsapp_canal_id: channel.id,
        contato_jid: jid,
        telefone,
        nome: String(item?.name || item?.notify || item?.short || "").trim() || null,
        nome_verificado: String(item?.verifiedName || "").trim() || null,
        ativo: true,
        sincronizado_em: now,
        updated_at: now,
      };
    })
    .filter(Boolean)
    .slice(0, 5000);

  if (!contacts.length) return { total: 0 };
  const { error } = await db
    .from("atendimento_whatsapp_contatos")
    .upsert(contacts, { onConflict: "empresa_id,whatsapp_canal_id,contato_jid" });
  if (error) throw error;
  return { total: contacts.length };
}

async function syncGroups(config: any, channel: any, rawGroups: any[]) {
  const now = new Date().toISOString();
  const groups = (Array.isArray(rawGroups) ? rawGroups : [])
    .map((g: any) => ({
      jid: String(g?.jid || "").trim(),
      nome: String(g?.nome || "").trim(),
      participantes: Math.max(0, Number(g?.participantes || 0)),
    }))
    .filter((g: any) => g.jid.endsWith("@g.us") && g.nome)
    .slice(0, 1000);

  for (const group of groups) {
    const { data: saved, error } = await db.from("atendimento_whatsapp_grupos").upsert({
      empresa_id: config.empresa_id,
      whatsapp_canal_id: channel.id,
      grupo_jid: group.jid,
      nome: group.nome.slice(0, 240),
      participantes: group.participantes,
      ativo: true,
      sincronizado_em: now,
      updated_at: now,
    }, { onConflict: "empresa_id,whatsapp_canal_id,grupo_jid" }).select("id").single();
    if (error) throw error;

    const telefoneGrupo = digits(group.jid.split("@")[0]) || saved.id.replace(/\D/g, "").slice(0, 15) || "0";
    const { data: existing } = await db.from("atendimento_conversas")
      .select("id")
      .eq("empresa_id", config.empresa_id)
      .eq("whatsapp_canal_id", channel.id)
      .eq("whatsapp_chat_jid", group.jid)
      .maybeSingle();

    if (existing) {
      await db.from("atendimento_conversas").update({
        whatsapp_chat_tipo: "grupo",
        grupo_nome: group.nome.slice(0, 240),
        contato_nome: group.nome.slice(0, 240),
        whatsapp_numero: channel.numero_declarado,
        ocultar_da_caixa: false,
        updated_at: now,
      }).eq("id", existing.id);
    } else {
      const { error: convError } = await db.from("atendimento_conversas").insert({
        empresa_id: config.empresa_id,
        canal: "whatsapp",
        telefone: telefoneGrupo,
        contato_nome: group.nome.slice(0, 240),
        cliente_id: null,
        whatsapp_canal_id: channel.id,
        whatsapp_numero: channel.numero_declarado,
        whatsapp_chat_tipo: "grupo",
        whatsapp_chat_jid: group.jid,
        grupo_nome: group.nome.slice(0, 240),
        ocultar_da_caixa: false,
        status: "aguardando",
      });
      if (convError) throw convError;
    }
  }

  return { total: groups.length };
}


function historyIsoTimestamp(value: unknown) {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const ms = raw > 10_000_000_000 ? raw : raw * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function syncChats(config: any, channel: any, rawChats: any[]) {
  const chats = (Array.isArray(rawChats) ? rawChats : [])
    .map((item: any) => {
      const jid = String(item?.jid || "").trim();
      const chatTipo = String(item?.chatTipo || "") === "grupo" ? "grupo" : "contato";
      const telefone = normalizePhone(item?.telefone || "") || digits(jid.split("@")[0]) || null;
      if (!jid || (!telefone && chatTipo !== "grupo")) return null;
      return {
        jid,
        chatTipo,
        telefone: telefone || "0",
        nome: String(item?.nome || "").trim() || null,
        grupoNome: String(item?.grupoNome || "").trim() || null,
        archived: item?.archived === true,
        unreadCount: Math.max(0, Number(item?.unreadCount || 0)),
        timestamp: historyIsoTimestamp(item?.timestamp),
      };
    })
    .filter(Boolean)
    .slice(0, 1000) as any[];

  if (!chats.length) return { total: 0, criadas: 0, atualizadas: 0 };

  const jids = [...new Set(chats.map((item: any) => item.jid))];
  const { data: existingRows, error: existingError } = await db
    .from("atendimento_conversas")
    .select("id,whatsapp_chat_jid,contato_nome,grupo_nome,status,ultima_mensagem_em")
    .eq("empresa_id", config.empresa_id)
    .eq("whatsapp_canal_id", channel.id)
    .in("whatsapp_chat_jid", jids);
  if (existingError) throw existingError;

  const existingByJid = new Map((existingRows || []).map((row: any) => [String(row.whatsapp_chat_jid || ""), row]));
  let criadas = 0;
  let atualizadas = 0;
  const now = new Date().toISOString();

  for (const chat of chats) {
    const existing = existingByJid.get(chat.jid);
    const displayName = chat.chatTipo === "grupo"
      ? (chat.grupoNome || chat.nome || "Grupo WhatsApp")
      : (chat.nome || chat.telefone || "Contato WhatsApp");

    if (existing) {
      const payload: Record<string, unknown> = {
        contato_nome: displayName || existing.contato_nome || null,
        whatsapp_numero: channel.numero_declarado,
        whatsapp_chat_tipo: chat.chatTipo,
        grupo_nome: chat.chatTipo === "grupo" ? (chat.grupoNome || displayName) : null,
        ocultar_da_caixa: false,
        updated_at: now,
      };
      if (chat.timestamp && !existing.ultima_mensagem_em) payload.ultima_mensagem_em = chat.timestamp;
      const { error } = await db.from("atendimento_conversas").update(payload).eq("id", existing.id);
      if (error) throw error;
      atualizadas += 1;
      continue;
    }

    const { data: created, error } = await db.from("atendimento_conversas").insert({
      empresa_id: config.empresa_id,
      canal: "whatsapp",
      telefone: chat.telefone || "0",
      contato_nome: displayName,
      cliente_id: null,
      whatsapp_canal_id: channel.id,
      whatsapp_numero: channel.numero_declarado,
      whatsapp_chat_tipo: chat.chatTipo,
      whatsapp_chat_jid: chat.jid,
      grupo_nome: chat.chatTipo === "grupo" ? (chat.grupoNome || displayName) : null,
      ocultar_da_caixa: false,
      status: "finalizado",
      responsavel_id: null,
      responsavel_nome: null,
      nao_lidas: 0,
      ultima_mensagem_em: chat.timestamp,
      updated_at: now,
    }).select("id,whatsapp_chat_jid,contato_nome,grupo_nome,status,ultima_mensagem_em").single();
    if (error) throw error;
    existingByJid.set(chat.jid, created);
    criadas += 1;
  }

  return { total: chats.length, criadas, atualizadas };
}

async function syncHistoryMessages(config: any, channel: any, rawMessages: any[]) {
  const messages = (Array.isArray(rawMessages) ? rawMessages : [])
    .map((item: any) => {
      const whatsappMessageId = String(item?.whatsappMessageId || "").trim();
      const chatJid = String(item?.chatJid || "").trim();
      const chatTipo = String(item?.chatTipo || "") === "grupo" ? "grupo" : "contato";
      const telefone = normalizePhone(item?.telefone || "") || digits(chatJid.split("@")[0]) || null;
      if (!whatsappMessageId || !chatJid || (!telefone && chatTipo !== "grupo")) return null;
      const timestamp = item?.timestamp ? new Date(String(item.timestamp)).toISOString() : null;
      return {
        whatsappMessageId,
        chatJid,
        chatTipo,
        telefone: telefone || "0",
        contatoNome: String(item?.contatoNome || "").trim() || null,
        grupoNome: String(item?.grupoNome || "").trim() || null,
        participanteJid: String(item?.participanteJid || "").trim() || null,
        participanteTelefone: normalizePhone(item?.participanteTelefone || "") || null,
        participanteNome: String(item?.participanteNome || "").trim() || null,
        fromMe: item?.fromMe === true,
        messageType: String(item?.messageType || "text"),
        texto: String(item?.texto || "[Mensagem]"),
        timestamp,
        mimeType: item?.mimeType ? mediaMime(item.mimeType) : null,
        fileName: String(item?.fileName || "").trim() || null,
        payload: item?.payload && typeof item.payload === "object" ? item.payload : {},
      };
    })
    .filter(Boolean)
    .slice(0, 500) as any[];

  if (!messages.length) return { total: 0, inseridas: 0, duplicadas: 0 };

  const chatsMap = new Map<string, any>();
  for (const msg of messages) {
    if (!chatsMap.has(msg.chatJid)) {
      chatsMap.set(msg.chatJid, {
        jid: msg.chatJid,
        chatTipo: msg.chatTipo,
        telefone: msg.telefone,
        nome: msg.contatoNome,
        grupoNome: msg.grupoNome,
        timestamp: msg.timestamp ? Math.floor(new Date(msg.timestamp).getTime() / 1000) : null,
      });
    }
  }
  await syncChats(config, channel, [...chatsMap.values()]);

  const ids = [...new Set(messages.map((item: any) => item.whatsappMessageId))];
  const { data: existingMessages, error: existingMsgError } = await db
    .from("atendimento_mensagens")
    .select("whatsapp_message_id")
    .eq("empresa_id", config.empresa_id)
    .in("whatsapp_message_id", ids);
  if (existingMsgError) throw existingMsgError;
  const existingIds = new Set((existingMessages || []).map((row: any) => String(row.whatsapp_message_id || "")));

  const jids = [...new Set(messages.map((item: any) => item.chatJid))];
  const { data: conversations, error: convReadError } = await db
    .from("atendimento_conversas")
    .select("id,whatsapp_chat_jid,ultima_mensagem_em,ultimo_preview,ultima_entrada_em,ultima_saida_em")
    .eq("empresa_id", config.empresa_id)
    .eq("whatsapp_canal_id", channel.id)
    .in("whatsapp_chat_jid", jids);
  if (convReadError) throw convReadError;
  const conversationByJid = new Map((conversations || []).map((row: any) => [String(row.whatsapp_chat_jid || ""), row]));

  const rows = messages
    .filter((msg: any) => !existingIds.has(msg.whatsappMessageId))
    .map((msg: any) => {
      const conversation = conversationByJid.get(msg.chatJid);
      if (!conversation) return null;
      return {
        empresa_id: config.empresa_id,
        conversa_id: conversation.id,
        sessao_id: null,
        direcao: msg.fromMe ? "saida" : "entrada",
        tipo: atlasMessageType(msg.messageType),
        texto: msg.texto,
        media_url: null,
        mime_type: msg.mimeType,
        whatsapp_message_id: msg.whatsappMessageId,
        provider_timestamp: msg.timestamp,
        created_at: msg.timestamp || new Date().toISOString(),
        payload: {
          transporte: "qr_gateway",
          origem: "historico_whatsapp",
          whatsapp_canal_id: channel.id,
          whatsapp_numero: channel.numero_declarado,
          fileName: msg.fileName,
          historico: true,
          participante_jid: msg.participanteJid,
          participante_telefone: msg.participanteTelefone,
          participante_nome: msg.participanteNome,
          ...(msg.payload || {}),
        },
      };
    })
    .filter(Boolean);

  if (rows.length) {
    const { error: insertError } = await db.from("atendimento_mensagens").insert(rows);
    if (insertError && insertError.code !== "23505") throw insertError;
  }

  const latestByJid = new Map<string, any>();
  for (const msg of messages) {
    if (!msg.timestamp) continue;
    const current = latestByJid.get(msg.chatJid);
    if (!current || new Date(msg.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      latestByJid.set(msg.chatJid, msg);
    }
  }

  for (const [jid, msg] of latestByJid) {
    const conversation = conversationByJid.get(jid);
    if (!conversation) continue;
    const currentTs = conversation.ultima_mensagem_em ? new Date(conversation.ultima_mensagem_em).getTime() : 0;
    const incomingTs = new Date(msg.timestamp).getTime();
    if (!Number.isFinite(incomingTs) || incomingTs <= currentTs) continue;

    const payload: Record<string, unknown> = {
      ultimo_preview: msg.texto,
      ultima_mensagem_em: msg.timestamp,
      updated_at: new Date().toISOString(),
    };
    if (msg.fromMe) payload.ultima_saida_em = msg.timestamp;
    else payload.ultima_entrada_em = msg.timestamp;
    const { error } = await db.from("atendimento_conversas").update(payload).eq("id", conversation.id);
    if (error) throw error;
  }

  return {
    total: messages.length,
    inseridas: rows.length,
    duplicadas: messages.length - rows.length,
  };
}


async function ensureTaskColumn(empresaId: string, usuarioId: string) {
  const { data: existing } = await db.from("tarefa_colunas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await db.from("tarefa_colunas").insert({
    empresa_id: empresaId,
    usuario_id: usuarioId,
    nome: "A fazer",
    ordem: 0,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

function appendRaw(base: unknown, line: string) {
  const atual = String(base || "").trim();
  return atual ? `${atual}\n\n${line}` : line;
}

function openCodeText(payload: any) {
  const data = payload?.data || payload || {}
  const parts = Array.isArray(data?.parts) ? data.parts : []
  const textos = parts
    .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
    .map((p: any) => String(p.text || "").trim())
    .filter(Boolean)
  if (textos.length) return textos.join("\n").trim()
  if (typeof data?.text === "string") return String(data.text).trim()
  return ""
}

function parseJsonObject(text: string) {
  const limpo = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const inicio = limpo.indexOf("{")
  const fim = limpo.lastIndexOf("}")
  if (inicio < 0 || fim <= inicio) throw new Error("IA nao retornou JSON estruturado.")
  return JSON.parse(limpo.slice(inicio, fim + 1))
}

function textoOpcional(value: unknown) {
  const s = String(value ?? "").trim()
  return s && !["null", "undefined", "nao informado", "não informado"].includes(s.toLocaleLowerCase("pt-BR"))
    ? s
    : null
}

function numeroOpcional(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function itensEstruturados(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 40).map((item: any) => ({
    ambiente: textoOpcional(item?.ambiente),
    tipo_esquadria: textoOpcional(item?.tipo_esquadria) || "outro",
    tipo_outro_texto: textoOpcional(item?.tipo_outro_texto),
    largura_mm: numeroOpcional(item?.largura_mm),
    altura_mm: numeroOpcional(item?.altura_mm),
    quantidade: Math.max(1, Math.round(numeroOpcional(item?.quantidade) || 1)),
    descricao: textoOpcional(item?.descricao),
  }))
}

async function aiGatewayCall(baseUrl: string, gatewayToken: string, path: string, body: unknown) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-atlas-automation-token": gatewayToken,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await resp.text()
    let data: any = {}
    if (raw) {
      try { data = JSON.parse(raw) } catch { data = { text: raw } }
    }
    if (!resp.ok) {
      throw new Error(String(data?.error?.message || data?.error || data?.message || `IA HTTP ${resp.status}`).slice(0, 800))
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

async function estruturarIntakeComIA(intakeId: string, gatewayToken: string) {
  await new Promise(resolve => setTimeout(resolve, 12_000))

  const { data: intake, error: intakeError } = await db
    .from("atendimento_whatsapp_intakes")
    .select("*, atendimento_whatsapp_grupos(nome)")
    .eq("id", intakeId)
    .maybeSingle()
  if (intakeError || !intake) return

  const ultima = new Date(intake.ultima_mensagem_em).getTime()
  if (!Number.isFinite(ultima) || Date.now() - ultima < 10_000) return

  if (
    intake.ai_status === "concluido" &&
    intake.ai_processado_em &&
    new Date(intake.ai_processado_em).getTime() >= ultima
  ) return
  if (intake.ai_status === "processando") return

  const snapshotUltimaMensagem = String(intake.ultima_mensagem_em)
  await db.from("atendimento_whatsapp_intakes").update({
    ai_status: "processando",
    ai_erro: null,
    updated_at: new Date().toISOString(),
  }).eq("id", intake.id)

  try {
    const { data: endpoint, error: endpointError } = await db
      .from("ai_runtime_endpoints")
      .select("base_url")
      .eq("chave", "opencode_gateway")
      .eq("ativo", true)
      .maybeSingle()
    if (endpointError) throw endpointError
    const baseUrl = String(endpoint?.base_url || "").replace(/\/$/, "")
    if (!baseUrl) throw new Error("Endpoint privado do OpenCode nao configurado.")

    const sessao = await aiGatewayCall(baseUrl, gatewayToken, "/session", {
      title: `WhatsApp Orcamento - ${intake.id}`.slice(0, 120),
    })
    const sessionId = String(sessao?.data?.id || sessao?.id || "").trim()
    if (!sessionId) throw new Error("OpenCode nao retornou sessao.")

    const anexos = Array.isArray(intake.anexos) ? intake.anexos : []
    const system = [
      "Voce estrutura pedidos de orcamento recebidos pelo WhatsApp da Esquadrifacio dentro do Atlas One.",
      "Responda SOMENTE com JSON valido, sem markdown.",
      "Extraia apenas informacoes explicitamente presentes no conteudo. Nunca invente medida, preco, cidade, acabamento, quantidade ou tipologia.",
      "O remetente do grupo pode ser apenas quem encaminhou a mensagem e nao necessariamente o cliente.",
      "Se um dado nao estiver presente, use null. Se houver duvida, registre em pendencias.",
      "Medidas devem ser convertidas para milimetros apenas quando a unidade estiver explicita.",
      "Nao calcule preco nem custo nesta etapa.",
      "Schema obrigatorio: {cliente_nome:string|null,cliente_whatsapp:string|null,cidade:string|null,obra_nome:string|null,obra_endereco:string|null,acabamento:string|null,contramarco:string|null,tipo_medida:string|null,itens:Array<{ambiente:string|null,tipo_esquadria:string|null,tipo_outro_texto:string|null,largura_mm:number|null,altura_mm:number|null,quantidade:number|null,descricao:string|null}>,resumo:string|null,observacoes:string|null,pendencias:string[]}.",
    ].join("\n")

    const prompt = JSON.stringify({
      origem: "whatsapp_grupo_orcamento",
      grupo: intake?.atendimento_whatsapp_grupos?.nome || null,
      remetente_grupo: {
        nome: intake.participante_nome || null,
        telefone: intake.participante_telefone || null,
      },
      conteudo_bruto: intake.conteudo_bruto || "",
      anexos: anexos.map((a: any) => ({
        tipo: a?.tipo || null,
        nome: a?.nome || null,
        mime_type: a?.mime_type || null,
        tamanho: a?.tamanho || null,
      })),
    })

    const resposta = await aiGatewayCall(
      baseUrl,
      gatewayToken,
      `/session/${encodeURIComponent(sessionId)}/message`,
      {
        agent: "atlas-comercial",
        model: { providerID: "freellmapi", modelID: "auto" },
        system,
        parts: [{ type: "text", text: prompt }],
      },
    )
    const structured = parseJsonObject(openCodeText(resposta))

    const { data: intakeAtual } = await db
      .from("atendimento_whatsapp_intakes")
      .select("ultima_mensagem_em")
      .eq("id", intake.id)
      .maybeSingle()

    if (String(intakeAtual?.ultima_mensagem_em || "") !== snapshotUltimaMensagem) {
      await db.from("atendimento_whatsapp_intakes").update({
        ai_status: "pendente",
        ai_session_id: sessionId,
        ai_erro: null,
        updated_at: new Date().toISOString(),
      }).eq("id", intake.id)
      return
    }

    const itens = itensEstruturados(structured?.itens)
    const clienteNome = textoOpcional(structured?.cliente_nome)
    const clienteWhatsapp = normalizePhone(structured?.cliente_whatsapp || "")
    const pendencias = Array.isArray(structured?.pendencias)
      ? structured.pendencias.map((p: unknown) => String(p || "").trim()).filter(Boolean).slice(0, 30)
      : []

    if (intake.orcamento_id) {
      const update: Record<string, unknown> = {
        descricao_livre: intake.conteudo_bruto || "",
        updated_at: new Date().toISOString(),
      }
      if (clienteNome) update.cliente_nome = clienteNome
      if (clienteWhatsapp) update.cliente_whatsapp = clienteWhatsapp
      const cidade = textoOpcional(structured?.cidade)
      const obraNome = textoOpcional(structured?.obra_nome)
      const obraEndereco = textoOpcional(structured?.obra_endereco)
      const acabamento = textoOpcional(structured?.acabamento)
      const contramarco = textoOpcional(structured?.contramarco)
      const tipoMedida = textoOpcional(structured?.tipo_medida)
      if (cidade) update.cidade = cidade
      if (obraNome) update.obra_nome = obraNome
      if (obraEndereco) update.obra_endereco = obraEndereco
      if (acabamento) update.acabamento = acabamento
      if (contramarco) update.contramarco = contramarco
      if (tipoMedida) update.tipo_medida = tipoMedida
      if (itens.length) {
        update.itens = itens
        update.tipo_esquadria = itens[0]?.tipo_esquadria || "outro"
        if (itens.length === 1) {
          update.largura_mm = itens[0]?.largura_mm || null
          update.altura_mm = itens[0]?.altura_mm || null
          update.quantidade = itens[0]?.quantidade || 1
        }
      }
      const resumo = textoOpcional(structured?.resumo)
      const observacoes = textoOpcional(structured?.observacoes)
      update.observacoes = [
        "Entrada automatica pelo WhatsApp.",
        resumo ? `Resumo IA: ${resumo}` : null,
        observacoes ? `Observacoes: ${observacoes}` : null,
        pendencias.length ? `Pendencias: ${pendencias.join("; ")}` : "Pendencias: nenhuma identificada pela IA.",
        "Valores, custos e configuracoes tecnicas precisam seguir as regras do Atlas/W.Vetro e permanecem sem inferencia quando nao informados.",
      ].filter(Boolean).join("\n")

      await db.from("orcamentos")
        .update(update)
        .eq("id", intake.orcamento_id)
        .eq("empresa_id", intake.empresa_id)
        .eq("status", "rascunho")
    }

    if (intake.tarefa_id) {
      const nomeTarefa = clienteNome || intake.participante_nome || "Solicitacao WhatsApp"
      await db.from("tarefas").update({
        titulo: `Orcamento via WhatsApp - ${nomeTarefa}`.slice(0, 180),
        descricao: [
          `Grupo: ${intake?.atendimento_whatsapp_grupos?.nome || "WhatsApp"}`,
          clienteWhatsapp ? `WhatsApp identificado: ${clienteWhatsapp}` : null,
          textoOpcional(structured?.resumo) ? `Resumo IA: ${textoOpcional(structured?.resumo)}` : null,
          pendencias.length ? `Pendencias: ${pendencias.join("; ")}` : null,
          "",
          String(intake.conteudo_bruto || ""),
        ].filter(v => v !== null).join("\n"),
      }).eq("id", intake.tarefa_id).eq("empresa_id", intake.empresa_id)
    }

    await db.from("atendimento_whatsapp_intakes").update({
      ai_status: "concluido",
      ai_session_id: sessionId,
      ai_resultado: structured,
      ai_erro: null,
      ai_processado_em: new Date().toISOString(),
      status: intake.orcamento_id ? "processado" : intake.status,
      updated_at: new Date().toISOString(),
    }).eq("id", intake.id)
  } catch (error) {
    await db.from("atendimento_whatsapp_intakes").update({
      ai_status: "erro",
      ai_erro: String(error instanceof Error ? error.message : error).slice(0, 1200),
      updated_at: new Date().toISOString(),
    }).eq("id", intake.id)
  }
}

function executarEmBackground(promise: Promise<unknown>) {
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise)
  } else {
    void promise.catch(() => undefined)
  }
}

async function processGroupBudgetIntake(
  config: any,
  channel: any,
  conversation: any,
  body: any,
  messageRowId: string,
  text: string,
  now: string,
  gatewayToken: string,
) {
  if (String(body.chatTipo || "") !== "grupo") return null;
  const groupJid = String(body.chatJid || "");
  if (!groupJid.endsWith("@g.us")) return null;

  const tipoMensagem = atlasMessageType(body.messageType);
  if (tipoMensagem === "sistema" || tipoMensagem === "reacao") return null;

  const { data: group } = await db.from("atendimento_whatsapp_grupos")
    .select("id,nome")
    .eq("empresa_id", config.empresa_id)
    .eq("whatsapp_canal_id", channel.id)
    .eq("grupo_jid", groupJid)
    .eq("ativo", true)
    .maybeSingle();
  if (!group) return null;

  const { data: automation } = await db.from("atendimento_whatsapp_grupo_automacoes")
    .select("*")
    .eq("empresa_id", config.empresa_id)
    .eq("grupo_id", group.id)
    .eq("tipo", "orcamento")
    .eq("ativo", true)
    .maybeSingle();
  if (!automation) return null;

  const participantJid = String(body.participanteJid || body.participanteTelefone || "desconhecido");
  const participantPhone = normalizePhone(body.participanteTelefone || "");
  const participantName = String(body.participanteNome || "").trim() || "Contato encaminhado";
  const rawLine = `[${participantName}] ${String(text || "[Mensagem]").trim()}`;
  const attachment = body.mediaPath ? {
    mensagem_id: messageRowId,
    whatsapp_message_id: body.whatsappMessageId || null,
    tipo: tipoMensagem,
    nome: body.fileName || null,
    mime_type: body.mimeType ? mediaMime(body.mimeType) : null,
    media_path: body.mediaPath,
    tamanho: Number(body.mediaSize || 0) || null,
  } : null;

  const windowMinutes = Math.max(1, Math.min(120, Number(automation.janela_agregacao_minutos || 5)));
  const cutoff = new Date(new Date(now).getTime() - windowMinutes * 60_000).toISOString();
  const { data: existingIntake } = await db.from("atendimento_whatsapp_intakes")
    .select("*")
    .eq("empresa_id", config.empresa_id)
    .eq("automacao_id", automation.id)
    .eq("participante_jid", participantJid)
    .in("status", ["aberto", "rascunho_criado", "processado"])
    .gte("ultima_mensagem_em", cutoff)
    .order("ultima_mensagem_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingIntake) {
    const ids = Array.isArray(existingIntake.mensagens_ids) ? existingIntake.mensagens_ids : [];
    const anexos = Array.isArray(existingIntake.anexos) ? existingIntake.anexos : [];
    const content = appendRaw(existingIntake.conteudo_bruto, rawLine);

    const { error: intakeError } = await db.from("atendimento_whatsapp_intakes").update({
      participante_telefone: participantPhone || existingIntake.participante_telefone || null,
      participante_nome: participantName || existingIntake.participante_nome || null,
      conteudo_bruto: content,
      mensagens_ids: [...ids, body.whatsappMessageId || messageRowId],
      anexos: attachment ? [...anexos, attachment] : anexos,
      status: existingIntake.orcamento_id ? "rascunho_criado" : "aberto",
      ai_status: "pendente",
      ai_erro: null,
      ultima_mensagem_em: now,
      updated_at: now,
    }).eq("id", existingIntake.id);
    if (intakeError) throw intakeError;

    if (existingIntake.orcamento_id) {
      const { data: quote } = await db.from("orcamentos")
        .select("descricao_livre,status,modo_entrada")
        .eq("id", existingIntake.orcamento_id)
        .eq("empresa_id", config.empresa_id)
        .maybeSingle();
      if (quote?.status === "rascunho" && quote?.modo_entrada === "whatsapp") {
        await db.from("orcamentos").update({
          descricao_livre: content,
          updated_at: now,
        }).eq("id", existingIntake.orcamento_id).eq("empresa_id", config.empresa_id);
      }
    }

    if (existingIntake.tarefa_id) {
      await db.from("tarefas").update({
        descricao: `Grupo: ${group.nome}\nRemetente: ${participantName}${participantPhone ? ` · ${participantPhone}` : ""}\n\n${content}`,
      }).eq("id", existingIntake.tarefa_id).eq("empresa_id", config.empresa_id);
    }

    if (gatewayToken) executarEmBackground(estruturarIntakeComIA(existingIntake.id, gatewayToken));
    return { intakeId: existingIntake.id, orcamentoId: existingIntake.orcamento_id || null, appended: true };
  }

  let quoteId: string | null = null;
  if (automation.criar_rascunho !== false) {
    const { data: firstColumn } = await db.from("kanban_colunas")
      .select("id")
      .eq("empresa_id", config.empresa_id)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    quoteId = crypto.randomUUID();
    const { error: quoteError } = await db.from("orcamentos").insert({
      id: quoteId,
      empresa_id: config.empresa_id,
      cliente_nome: participantName,
      cliente_whatsapp: participantPhone || null,
      tipo_esquadria: "outro",
      modo_entrada: "whatsapp",
      descricao_livre: rawLine,
      observacoes: `Entrada automática pelo WhatsApp · Grupo: ${group.nome}. A IA deve estruturar somente informações explícitas; medidas, preço e configuração técnica ausentes permanecem pendentes.`,
      valor_estimado: null,
      status: "rascunho",
      origem: "whatsapp",
      itens: [],
      fotos_urls: [],
      anexos: [],
      coluna_id: firstColumn?.id || null,
      coluna_atualizada_em: now,
      revisao_grupo_id: quoteId,
      revisao_versao: 1,
      revisao_atual: true,
    });
    if (quoteError) throw quoteError;
  }

  let taskId: string | null = null;
  if (automation.criar_tarefa !== false && automation.responsavel_id) {
    const columnId = await ensureTaskColumn(config.empresa_id, automation.responsavel_id);
    const { data: task, error: taskError } = await db.from("tarefas").insert({
      empresa_id: config.empresa_id,
      usuario_id: automation.responsavel_id,
      coluna_id: columnId,
      titulo: `Orçamento via WhatsApp · ${participantName}`,
      descricao: `Grupo: ${group.nome}\nRemetente: ${participantName}${participantPhone ? ` · ${participantPhone}` : ""}\n\n${rawLine}`,
      prioridade: "normal",
      atribuida_em: now,
      orcamento_id: quoteId,
    }).select("id").single();
    if (taskError) throw taskError;
    taskId = task.id;

    await db.from("notificacoes").insert({
      empresa_id: config.empresa_id,
      usuario_id: automation.responsavel_id,
      categoria: "tarefas",
      tipo: "whatsapp_orcamento",
      titulo: "Novo orçamento via WhatsApp",
      mensagem: `${participantName} · ${group.nome}`,
      href: quoteId ? `/kanban?orcamento=${quoteId}` : "/tarefas",
      origem_tipo: "whatsapp_orcamento",
      origem_id: body.whatsappMessageId || messageRowId,
      push_status: "pendente",
    });
  }

  const { data: intake, error: intakeError } = await db.from("atendimento_whatsapp_intakes").insert({
    empresa_id: config.empresa_id,
    automacao_id: automation.id,
    grupo_id: group.id,
    conversa_id: conversation.id,
    participante_jid: participantJid,
    participante_telefone: participantPhone || null,
    participante_nome: participantName,
    status: quoteId ? "rascunho_criado" : "aberto",
    orcamento_id: quoteId,
    tarefa_id: taskId,
    conteudo_bruto: rawLine,
    mensagens_ids: [body.whatsappMessageId || messageRowId],
    anexos: attachment ? [attachment] : [],
    primeira_mensagem_em: now,
    ultima_mensagem_em: now,
  }).select("id").single();
  if (intakeError) throw intakeError;

  if (gatewayToken) executarEmBackground(estruturarIntakeComIA(intake.id, gatewayToken));
  return { intakeId: intake.id, orcamentoId: quoteId, tarefaId: taskId, appended: false };
}

async function conversationForInbound(
  config: any,
  channel: any,
  telefone: string,
  nome: string | null,
  texto: string | null,
  chatTipo = "contato",
  chatJid: string | null = null,
  grupoNome: string | null = null,
) {
  let query = db.from("atendimento_conversas")
    .select("*")
    .eq("empresa_id", config.empresa_id)
    .eq("canal", "whatsapp")
    .eq("whatsapp_canal_id", channel.id);

  query = chatJid
    ? query.eq("whatsapp_chat_jid", chatJid)
    : query.eq("telefone", telefone);

  const { data: existing } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isGroup = chatTipo === "grupo";
  const customer = isGroup ? null : await customerByPhone(config.empresa_id, telefone);

  let ownerId = channel.usuario_id || null;
  let sector = null;
  if (!isGroup && !ownerId && channel.principal) {
    const rule = await routingRule(config.empresa_id, texto);
    ownerId = rule?.usuario_id || config.usuario_padrao_id || null;
    sector = rule?.setor || config.setor_padrao || null;
  }
  const ownerName = await userName(ownerId);
  const displayName = isGroup ? (grupoNome || nome || "Grupo WhatsApp") : (nome || customer?.nome || null);

  if (existing) {
    const keepExistingOwner = existing.responsavel_id || ownerId;
    const keepExistingOwnerName = existing.responsavel_nome || (
      keepExistingOwner === ownerId ? ownerName : await userName(keepExistingOwner)
    );
    const { data, error } = await db.from("atendimento_conversas").update({
      contato_nome: displayName || existing.contato_nome || null,
      cliente_id: isGroup ? null : (customer?.id || existing.cliente_id || null),
      whatsapp_canal_id: channel.id,
      whatsapp_numero: channel.numero_declarado,
      whatsapp_chat_tipo: isGroup ? "grupo" : "contato",
      whatsapp_chat_jid: chatJid || existing.whatsapp_chat_jid || null,
      grupo_nome: isGroup ? (grupoNome || displayName) : null,
      ocultar_da_caixa: false,
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
    contato_nome: displayName,
    cliente_id: isGroup ? null : (customer?.id || null),
    whatsapp_canal_id: channel.id,
    whatsapp_numero: channel.numero_declarado,
    whatsapp_chat_tipo: isGroup ? "grupo" : "contato",
    whatsapp_chat_jid: chatJid || (telefone ? `${telefone}@s.whatsapp.net` : null),
    grupo_nome: isGroup ? (grupoNome || displayName) : null,
    ocultar_da_caixa: false,
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
    const gatewayToken = req.headers.get("x-atlas-gateway-token")?.trim() || "";
    const config = await authenticate(req);
    if (!config) return reply({ error: "Gateway nao autorizado." }, 401);

    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("mode") === "push-pending") {
      const item = await proximaNotificacaoPush(config);
      return reply({ ok: true, item });
    }

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

    if (type === "push_sent") {
      const resultado = await confirmarNotificacaoPush(config, body);
      return reply(resultado);
    }

    const bodyChannelId = String(body?.channelId || "");
    const channel = await getChannel(config.empresa_id, bodyChannelId);
    if (!channel) return reply({ error: "Canal nao encontrado." }, 404);

    if (type === "contacts_sync") {
      const result = await syncContacts(config, channel, body.contacts || []);
      return reply({ ok: true, ...result });
    }

    if (type === "groups_sync") {
      const result = await syncGroups(config, channel, body.groups || []);
      return reply({ ok: true, ...result });
    }

    if (type === "chats_sync") {
      const result = await syncChats(config, channel, body.chats || []);
      return reply({ ok: true, ...result });
    }

    if (type === "history_messages_sync") {
      const result = await syncHistoryMessages(config, channel, body.messages || []);
      return reply({ ok: true, ...result });
    }

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
      const remoteJid = String(body?.payload?.remoteJid || "");
      if (remoteJid === "status@broadcast" || remoteJid.endsWith("@broadcast") || remoteJid.endsWith("@newsletter")) {
        return reply({ ok: true, ignored: true, reason: "broadcast" });
      }

      const chatTipo = String(body.chatTipo || "contato") === "grupo" ? "grupo" : "contato";
      const chatJid = String(body.chatJid || "").trim() || null;
      const telefone = normalizePhone(body.telefone);
      if (!telefone && chatTipo !== "grupo") return reply({ error: "Telefone invalido." }, 400);

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
        telefone || digits(chatJid || "") || "0",
        body.contatoNome || null,
        body.texto || null,
        chatTipo,
        chatJid,
        body.grupoNome || null,
      );
      const session = await openSession(conversation);
      const now = body.timestamp || new Date().toISOString();
      const text = body.texto || "[Mensagem]";
      const fromMe = body.fromMe === true;

      const { data: messageRow, error: msgError } = await db.from("atendimento_mensagens").insert({
        empresa_id: config.empresa_id,
        conversa_id: conversation.id,
        sessao_id: session?.id || null,
        direcao: fromMe ? "saida" : "entrada",
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
      }).select("id").single();
      if (msgError) throw msgError;

      const conversaUpdate: Record<string, unknown> = {
        ultimo_preview: text,
        ultima_mensagem_em: now,
        status: conversation.responsavel_id ? "em_atendimento" : "aguardando",
        updated_at: new Date().toISOString(),
      };
      if (fromMe) {
        conversaUpdate.ultima_saida_em = now;
      } else {
        conversaUpdate.nao_lidas = Number(conversation.nao_lidas || 0) + 1;
        conversaUpdate.ultima_entrada_em = now;
      }
      const { error: convError } = await db.from("atendimento_conversas")
        .update(conversaUpdate)
        .eq("id", conversation.id);
      if (convError) throw convError;

      const intake = await processGroupBudgetIntake(
        config,
        channel,
        conversation,
        body,
        messageRow.id,
        text,
        now,
        gatewayToken,
      );

      if (!fromMe) {
        await notificarMensagemWhatsApp(config, channel, conversation, body, text);
      }

      await appendEvent(
        config.empresa_id,
        conversation.id,
        fromMe ? "mensagem_enviada_dispositivo_qr" : "mensagem_recebida_qr",
        {
          whatsapp_message_id: body.whatsappMessageId || null,
          tipo: body.messageType || "text",
          whatsapp_canal_id: channel.id,
          whatsapp_numero: channel.numero_declarado,
        },
        session?.id || null,
      );

      return reply({
        ok: true,
        duplicate: false,
        conversaId: conversation.id,
        intake: intake || null,
      });
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