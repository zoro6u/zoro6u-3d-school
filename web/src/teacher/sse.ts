export interface ChatEventText { event: 'text'; data: { text: string } }
export interface ChatEventAction { event: 'action'; data: unknown }
export interface ChatEventDone { event: 'done'; data: { stop_reason?: string } }
export interface ChatEventError { event: 'error'; data: { code: string; message: string } }
export type ChatEvent = ChatEventText | ChatEventAction | ChatEventDone | ChatEventError;

/** Parse a Server-Sent-Events byte stream into typed chat events. Tolerates chunk boundaries anywhere. */
export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buf += decoder.decode(value, { stream: !done });
      buf = buf.replace(/\r\n/g, '\n');
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = parseBlock(block);
        if (ev) yield ev;
      }
      if (done) break;
    }
    const tail = parseBlock(buf.trim());
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): ChatEvent | null {
  let event = '';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!event || !data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) } as ChatEvent;
  } catch {
    return null;
  }
}
