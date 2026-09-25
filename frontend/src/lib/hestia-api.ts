export const API_URL =
  process.env.NEXT_PUBLIC_HESTIA_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8484/api/v1";

export function generatedImageUrl(source: string, sessionId: string) {
  const match = source.match(/^hestia-image:\/\/([0-9a-f-]{36})$/i);
  return match
    ? `${API_URL}/sessions/${encodeURIComponent(sessionId)}/images/${match[1]}`
    : source;
}

export function attachmentUrl(sessionId: string, path: string) {
  return `${API_URL}/sessions/${encodeURIComponent(sessionId)}/${path.replace(/^\/+/, "")}`;
}

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

export type Session = {
  id: string;
  state: Record<string, unknown>;
  updated_at: number;
};

export type StoredAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  url: string;
};

export type StoredEvent = {
  id: string;
  kind: string;
  author: string;
  final: boolean;
  partial: boolean;
  text_delta?: string;
  timestamp: number;
  attachments?: StoredAttachment[];
};

const headers = (idToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${idToken}`,
});

export async function createSession(
  idToken: string,
  state: Record<string, unknown> = {},
): Promise<string> {
  const response = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: headers(idToken),
    body: JSON.stringify({ state }),
  });
  if (!response.ok) throw new Error("request_failed");
  return ((await response.json()) as Session).id;
}

export async function ensureSession(idToken: string, sessionId?: string | null) {
  if (sessionId) {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
      headers: headers(idToken),
      cache: "no-store",
    });
    if (response.ok) return sessionId;
    if (response.status !== 404) throw new Error("request_failed");
  }
  return createSession(idToken, { title: "New conversation" });
}

export async function listSessions(idToken: string): Promise<Session[]> {
  const response = await fetch(`${API_URL}/sessions`, {
    headers: headers(idToken),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("request_failed");
  return (await response.json()) as Session[];
}

export async function updateSession(
  idToken: string,
  sessionId: string,
  stateDelta: Record<string, unknown>,
) {
  const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: "PATCH",
    headers: headers(idToken),
    body: JSON.stringify({ state_delta: stateDelta }),
  });
  if (!response.ok) throw new Error("request_failed");
}

export async function getSessionEvents(idToken: string, sessionId: string) {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/events`, {
    headers: headers(idToken),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("request_failed");
  return (await response.json()) as { session_id: string; events: StoredEvent[] };
}

export async function discoverFoodLibrary() {
  const response = await fetch(`${API_URL}/library/discover`, { cache: "no-store" });
  if (!response.ok) throw new Error("library_unavailable");
  return response.json();
}

export async function searchFoodLibrary(query: string, kind: string, nutrient?: string) {
  const params = new URLSearchParams({ q: query, kind });
  if (nutrient) params.set("nutrient", nutrient);
  const response = await fetch(`${API_URL}/library/search?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("library_search_failed");
  return response.json();
}

export async function getMealProfile(mealId: string) {
  const response = await fetch(`${API_URL}/library/meals/${encodeURIComponent(mealId)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("meal_not_found");
  return response.json();
}

export async function getIngredientProfile(name: string) {
  const params = new URLSearchParams({ name });
  const response = await fetch(`${API_URL}/library/ingredients/profile?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ingredient_not_found");
  return response.json();
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
  idToken: string,
  sessionId: string,
  input: ChatInput,
  onEvent: (event: HestiaEvent) => void | Promise<void>,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: headers(idToken),
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
