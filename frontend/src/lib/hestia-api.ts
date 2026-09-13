const API_URL =
  process.env.NEXT_PUBLIC_HESTIA_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8484/api/v1";

export type InlineFile = {
  name: string;
  mime_type: string;
  data: string;
};

export type ChatInput = {
  text?: string;
  files?: InlineFile[];
};

export type HestiaEvent = {
  id?: string;
  event: string;
  data: Record<string, unknown>;
};

type Session = {
  id: string;
};

const headers = (userId: string) => ({
  "Content-Type": "application/json",
  "X-Hestia-User-Id": userId,
});

export async function createSession(userId: string): Promise<string> {
  const response = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("request_failed");
  return ((await response.json()) as Session).id;
}

export async function ensureSession(userId: string, sessionId?: string | null) {
  if (sessionId) {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
      headers: headers(userId),
      cache: "no-store",
    });
    if (response.ok) return sessionId;
    if (response.status !== 404) throw new Error("request_failed");
  }
  return createSession(userId);
}

function parseEvent(block: string): HestiaEvent | null {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];

  for (const line of block.split(/\r\n|\r|\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("id:")) id = line.slice(3).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;

  return { event, id, data: JSON.parse(data.join("\n")) as Record<string, unknown> };
}

export async function streamMessage(
  userId: string,
  sessionId: string,
  input: ChatInput,
  onEvent: (event: HestiaEvent) => void | Promise<void>,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({
      text: input.text || null,
      files: input.files || [],
      metadata: { client: "hestia-web" },
    }),
    signal,
  });
  if (!response.ok) throw new Error("request_failed");
  if (!response.body) throw new Error("request_failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = /\r?\n\r?\n/.exec(buffer);
    while (boundary?.index !== undefined) {
      const parsed = parseEvent(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary[0].length);
      if (parsed) await onEvent(parsed);
      boundary = /\r?\n\r?\n/.exec(buffer);
    }
    if (done) break;
  }

  const remaining = parseEvent(buffer.trim());
  if (remaining) await onEvent(remaining);
}

export function browserIdentity() {
  const userKey = "hestia-user-id";
  let userId = localStorage.getItem(userKey);
  if (!userId) {
    userId = `web-${crypto.randomUUID()}`;
    localStorage.setItem(userKey, userId);
  }
  return userId;
}

export function fileToInline(file: File): Promise<InlineFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => {
      const value = String(reader.result);
      resolve({
        name: file.name,
        mime_type: file.type || "image/jpeg",
        data: value.slice(value.indexOf(",") + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}
