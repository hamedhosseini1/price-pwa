/** Minimal Telegram Bot API client (send/edit/answer). Pure fetch, no deps. */

export interface TgKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

export function btn(text: string, data: string) {
  return { text, callback_data: data };
}

export class TgClient {
  constructor(private token: string, private base = "https://api.telegram.org") {}

  private async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.base}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new Error(`telegram/${method}: ${json.description ?? res.status}`);
    return json.result as T;
  }

  send(chatId: number | string, text: string, kb?: TgKeyboard) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(kb ? { reply_markup: kb } : {}),
    });
  }

  edit(chatId: number | string, messageId: number, text: string, kb?: TgKeyboard) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(kb ? { reply_markup: kb } : {}),
    });
  }

  answer(callbackId: string, text?: string) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackId,
      ...(text ? { text } : {}),
    });
  }

  getMe() {
    return this.call<{ id: number; username: string }>("getMe", {});
  }

  setWebhook(url: string, secret: string) {
    return this.call("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
