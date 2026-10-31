import { parseSSE, type ChatEvent } from './sse';

export interface ChatRequest {
  lesson_id: string;
  lang: 'en' | 'ar';
  mode: 'explain' | 'socratic';
  messages: { role: 'user' | 'assistant'; content: string }[];
  scene_state: Record<string, unknown> | null;
}

/** Non-2xx responses from the API (before streaming starts). `code` matches the server's error codes. */
export class ChatHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function* streamChat(req: ChatRequest, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): AsyncGenerator<ChatEvent> {
  const res = await fetchImpl(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    let code = 'http_error';
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: { code?: string; message?: string } | string };
      if (typeof j.detail === 'object' && j.detail) {
        code = j.detail.code ?? code;
        message = j.detail.message ?? message;
      }
    } catch {
      /* non-JSON error body */
    }
    const retry = Number(res.headers.get('retry-after'));
    throw new ChatHttpError(res.status, code, message, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  yield* parseSSE(res.body);
}

export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<{ llm: boolean; provider: string | null } | null> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as { llm: boolean; provider: string | null };
  } catch {
    return null;
  }
}
