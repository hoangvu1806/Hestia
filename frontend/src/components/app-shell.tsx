"use client";

import Image from "next/image";
import Link from "next/link";
import rehypeKatex from "rehype-katex";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./auth-provider";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { MarkdownPre } from "./mermaid-diagram";
import { ThemeToggle } from "./theme-toggle";

import type { Dictionary } from "@/i18n/dictionaries";
import {
  attachmentUrl,
  createSession,
  ensureSession,
  fileToInline,
  generatedImageUrl,
  getSessionEvents,
  type InlineFile,
  listSessions,
  type Session,
  type StoredAttachment,
  type StoredEvent,
  streamMessage,
  updateSession,
} from "@/lib/hestia-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  attachments?: StoredAttachment[];
  status?: string;
  streaming?: boolean;
  error?: boolean;
  progress?: Array<{ label: string; done: boolean }>;
  activity?: number;
};

function restoredMessages(events: StoredEvent[]): Message[] {
  return events.flatMap<Message>((event) => {
    const content = event.text_delta?.trim() || "";
    const attachments = event.attachments || [];
    if (event.author === "user" && (content || attachments.length)) {
      return [{
        id: event.id,
        role: "user",
        content,
        attachments,
      }];
    }
    if (event.author === "root_agent" && event.final && content) {
      return [{ id: event.id, role: "assistant", content }];
    }
    return [];
  });
}

const PrivateImage = memo(function PrivateImage({
  alt,
  className,
  height,
  src,
  width,
}: {
  alt: string;
  className?: string;
  height: number;
  src: string;
  width: number;
}) {
  const { user } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let createdUrl: string | null = null;
    user.getIdToken()
      .then((token) => fetch(src, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }))
      .then((response) => {
        if (!response.ok) throw new Error("image_load_failed");
        return response.blob();
      })
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setObjectUrl(null);
        }
      });
    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, user]);

  if (!objectUrl) return null;
  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      src={objectUrl}
      unoptimized
      width={width}
    />
  );
});

const navItems = [
  ["chat", "chat", "/chat"],
  ["ingredients", "ingredients", "/ingredients"],
] as const;

const sessionKey = (uid: string) => `hestia-session-id:${uid}`;
const foodbTag = /\[(?:<)?([^:\]<>\n]+):(FDB\d+)(?:>)?\]/gi;
const foodbFoodTag = /\[(?:<)?([^:\]<>\n]+):(FOOD\d+)(?:>)?\]/gi;
const libraryTag = /\[(?:<)?(ingredient|dish|nutrient|compound)\s*:\s*([^|>\]\n]+?)(?:\s*\|\s*([^|>\]\n]+?))?(?:\s*\|\s*([^>\]\n]+?))?(?:>)?\]/gi;
const legacyDishTag = /\[([^|:\]\n]{2,80})\s*\|\s*([A-Za-z][A-Za-z '\-]{1,79})\]/g;
const markdownCode = /(```[\s\S]*?```|`[^`\n]+`)/g;
const duplicatedMathOpen = /\$\s+\$(?=\s*\\(?:le|ge|lt|gt|approx|sim|pm|times|frac|text|circ))/g;
const markdownLink = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g;

type EvidenceSource = { href: string; label: string; host: string };

function sessionTitle(session: Session) {
  const title = session.state.title;
  return typeof title === "string" && title.trim() ? title : "New conversation";
}

function relativeDate(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function normalizeMathNotation(markdown: string) {
  return markdown
    .replace(duplicatedMathOpen, "$")
    .replace(
      /^\s*\\?\[((?=\\(?:text|frac|dfrac|sqrt|mathrm|mathbf|operatorname))[^\n]+?)\\?\]\s*$/gm,
      (_, formula: string) => `$$\n${formula.trim()}\n$$`,
    )
    .replace(/\\\[/g, () => "\n$$\n")
    .replace(/\\\]/g, () => "\n$$\n")
    .replace(/\\\((.+?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(
      /\(([^()\n]*\\(?:text|times|frac|dfrac|cdot|approx|mathrm)[^()\n]*)\)/g,
      (_, formula: string) => `($${formula.trim()}$)`,
    );
}

function markdownUrlTransform(value: string) {
  if (/^hestia-image:\/\/[0-9a-f-]{36}$/i.test(value)) return value;
  return defaultUrlTransform(value);
}

function libraryHref(kind: string, lookupName: string, id?: string, displayName?: string) {
  const mode = kind === "dish"
    ? "meals"
    : kind === "nutrient"
      ? "nutrients"
      : kind === "compound"
        ? "chemistry"
        : "foods";
  const params = new URLSearchParams({ q: lookupName.trim(), kind: mode });
  if (kind === "nutrient") params.set("nutrient", lookupName.trim().toLowerCase());
  if (id?.trim()) params.set("entity", id.trim());
  if (kind === "dish" && displayName?.trim()) params.set("label", displayName.trim());
  return `/ingredients?${params.toString()}`;
}

function libraryEntityHref(
  kind: string,
  displayName: string,
  lookupOrId?: string,
  explicitId?: string,
) {
  const possibleLookup = lookupOrId?.trim() || "";
  const possibleId = explicitId?.trim() || "";
  const legacyId = /^(?:FDB|FOOD)\d+$/i.test(possibleLookup) ? possibleLookup : "";
  const lookupName = legacyId ? displayName : possibleLookup || displayName;
  const id = /^(?:FDB|FOOD)\d+$/i.test(possibleId) ? possibleId : legacyId;
  return libraryHref(kind, lookupName, id.toUpperCase(), displayName);
}

function decorateLibraryTags(markdown: string) {
  return markdown
    .split(markdownCode)
    .map((part, index) =>
      index % 2
        ? part
        : normalizeMathNotation(part)
            .replace(
              libraryTag,
              (
                _,
                kind: string,
                displayName: string,
                lookupOrId?: string,
                explicitId?: string,
              ) => {
                const normalizedKind = kind.toLowerCase();
                const href = libraryEntityHref(
                  normalizedKind,
                  displayName,
                  lookupOrId,
                  explicitId,
                );
                return `[${displayName.trim()}](${href} "hestia-library:${normalizedKind}")`;
              },
            )
            .replace(legacyDishTag, (_, displayName: string, lookupName: string) =>
              `[${displayName.trim()}](${libraryHref("dish", lookupName, undefined, displayName)} "hestia-library:dish")`,
            )
            .replace(foodbTag, (_, name: string, id: string) =>
              `[${name.trim()}](${libraryHref("compound", name, id.toUpperCase())} "hestia-library:compound:${id.toUpperCase()}")`,
            )
            .replace(foodbFoodTag, (_, name: string, id: string) =>
              `[${name.trim()}](${libraryHref("ingredient", name, id.toUpperCase())} "hestia-library:ingredient:${id.toUpperCase()}")`,
            ),
    )
    .join("");
}

function LibraryEntity({ href, kind, name }: { href: string; kind: string; name: string }) {
  return (
    <Link
      className={`library-entity ${kind}`}
      href={href}
      title={`Open ${name} in the Hestia Library`}
    >
      <small>{kind}</small>
      <span>{name}</span>
      <b aria-hidden="true">↗</b>
    </Link>
  );
}

function sourceHost(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function evidenceSources(markdown: string): EvidenceSource[] {
  const sources = new Map<string, EvidenceSource>();
  for (const match of markdown.matchAll(markdownLink)) {
    const href = match[2];
    if (!sources.has(href)) {
      sources.set(href, {
        href,
        label: match[1].replace(/[*_`]/g, "").trim(),
        host: sourceHost(href),
      });
    }
  }
  return [...sources.values()].slice(0, 8);
}

function EvidenceRail({ markdown, title }: { markdown: string; title: string }) {
  const sources = evidenceSources(markdown);
  if (!sources.length) return null;
  return (
    <aside aria-label={title} className="evidence-rail">
      <div className="evidence-rail-title">
        <span aria-hidden="true" />
        <strong>{title}</strong>
        <small>{sources.length}</small>
      </div>
      <div className="evidence-source-list">
        {sources.map((source, index) => (
          <a href={source.href} key={source.href} rel="noreferrer" target="_blank">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{source.label}</strong>
            <small>{source.host}</small>
          </a>
        ))}
      </div>
    </aside>
  );
}

const MessageMarkdown = memo(function MessageMarkdown({
  aiIllustration,
  complete,
  content,
  sessionId,
  sourcesTitle,
}: {
  aiIllustration: string;
  complete: boolean;
  content: string;
  sessionId: string;
  sourcesTitle: string;
}) {
  const components = useMemo<Components>(() => ({
    pre: MarkdownPre,
    img: ({ alt, src }) => {
      const source = typeof src === "string" ? src : "";
      const generated = /^hestia-image:\/\//i.test(source);
      return (
        <figure className="generated-illustration">
          {generated ? (
            <PrivateImage
              alt={alt || aiIllustration}
              height={768}
              src={generatedImageUrl(source, sessionId)}
              width={1024}
            />
          ) : (
            <Image
              alt={alt || ""}
              height={768}
              src={source}
              unoptimized
              width={1024}
            />
          )}
          <figcaption>{aiIllustration}</figcaption>
        </figure>
      );
    },
    a: ({ children, href, title }) => {
      const entity = title?.match(
        /^hestia-library:(ingredient|dish|nutrient|compound):/i,
      );
      if (entity && href) {
        return (
          <LibraryEntity
            href={href}
            kind={entity[1].toLowerCase()}
            name={String(children)}
          />
        );
      }
      return (
        <a className="evidence-link" href={href} rel="noreferrer" target="_blank">
          {children}<span aria-hidden="true">↗</span>
        </a>
      );
    },
  }), [aiIllustration, sessionId]);

  return (
    <div className="message-text">
      <ReactMarkdown
        components={components}
        rehypePlugins={[[rehypeKatex, { output: "htmlAndMathml", strict: false }]]}
        remarkPlugins={[remarkGfm, remarkMath]}
        skipHtml
        urlTransform={markdownUrlTransform}
      >
        {decorateLibraryTags(content)}
      </ReactMarkdown>
      {complete ? <EvidenceRail markdown={content} title={sourcesTitle} /> : null}
    </div>
  );
});

function progressiveText(onText: (text: string) => void) {
  let received = "";
  let displayed = "";
  let ended = false;
  let cancelled = false;
  let wake: (() => void) | undefined;

  const notify = () => {
    wake?.();
    wake = undefined;
  };

  const task = (async () => {
    while (!cancelled) {
      if (displayed.length < received.length) {
        const remaining = received.length - displayed.length;
        const step = Math.max(1, Math.ceil(remaining / 18));
        displayed = received.slice(0, displayed.length + step);
        onText(displayed);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        continue;
      }
      if (ended) break;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  })();

  return {
    append(delta: string) {
      received += delta;
      notify();
    },
    reconcile(finalText: string) {
      received = finalText;
      if (displayed.length > received.length) displayed = received;
      notify();
    },
    async finish() {
      ended = true;
      notify();
      await task;
      return received;
    },
    cancel() {
      cancelled = true;
      notify();
    },
  };
}

export function AppShell({
  dictionary,
  initialPrompt = "",
}: {
  dictionary: Dictionary;
  initialPrompt?: string;
}) {
  const { brand, chat, composer, header, profile, sidebar, welcome } = dictionary;
  const { signOut, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialPrompt);
  const [pendingFile, setPendingFile] = useState<InlineFile | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "ready" | "error">(
    "connecting",
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string | null>(null);
  const connectionPromise = useRef<Promise<string> | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const accountMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeAccount(event: PointerEvent) {
      if (!accountMenu.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function closeWithEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    window.addEventListener("pointerdown", closeAccount);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      window.removeEventListener("pointerdown", closeAccount);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const key = sessionKey(user.uid);
    const pending = user.getIdToken().then(async (token) => {
      const resolved = await ensureSession(token, localStorage.getItem(key));
      const [available, history] = await Promise.all([
        listSessions(token),
        getSessionEvents(token, resolved),
      ]);
      if (active) {
        setSessions([...available].sort((a, b) => b.updated_at - a.updated_at));
        setMessages(restoredMessages(history.events));
      }
      return resolved;
    });
    connectionPromise.current = pending;

    pending
      .then((resolved) => {
        sessionId.current = resolved;
        setActiveSessionId(resolved);
        localStorage.setItem(key, resolved);
        if (active) setConnection("ready");
      })
      .catch(() => {
        connectionPromise.current = null;
        if (active) setConnection("error");
      });
    return () => {
      active = false;
      activeRequest.current?.abort();
    };
  }, [user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: busy ? "auto" : "smooth" });
    } else if (conversation.current) {
      const el = conversation.current;
      el.scrollTo({ top: el.scrollHeight, behavior: busy ? "auto" : "smooth" });
    }
  }, [messages, busy]);

  async function activeSession() {
    if (sessionId.current) return sessionId.current;
    if (connectionPromise.current) return connectionPromise.current;

    if (!user) throw new Error("authentication_required");
    setConnection("connecting");
    const key = sessionKey(user.uid);
    const pending = user.getIdToken().then((token) =>
      ensureSession(token, localStorage.getItem(key)),
    );
    connectionPromise.current = pending;
    try {
      const resolved = await pending;
      sessionId.current = resolved;
      setActiveSessionId(resolved);
      localStorage.setItem(key, resolved);
      setConnection("ready");
      return resolved;
    } catch (error) {
      connectionPromise.current = null;
      setConnection("error");
      throw error;
    }
  }

  async function refreshSessions(token?: string) {
    if (!user) return;
    const available = await listSessions(token || await user.getIdToken());
    setSessions([...available].sort((a, b) => b.updated_at - a.updated_at));
  }

  async function openConversation(nextSession: Session) {
    if (!user || busy) return;
    setConnection("connecting");
    try {
      const token = await user.getIdToken();
      const result = await getSessionEvents(token, nextSession.id);
      const restored = restoredMessages(result.events);
      sessionId.current = nextSession.id;
      setActiveSessionId(nextSession.id);
      connectionPromise.current = Promise.resolve(nextSession.id);
      localStorage.setItem(sessionKey(user.uid), nextSession.id);
      setMessages(restored);
      setConnection("ready");
    } catch {
      setConnection("error");
    }
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    );
  }

  function advanceProgress(id: string, label: string) {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== id) return message;
        const progress = message.progress || [];
        if (progress.at(-1)?.label === label && !progress.at(-1)?.done) return message;
        if (progress.some((step) => step.label === label)) return message;
        return {
          ...message,
          status: undefined,
          activity: 0,
          progress: [
            ...progress.map((step) => ({ ...step, done: true })),
            { label, done: false },
          ].slice(-6),
        };
      }),
    );
  }


  function pulseProgress(id: string, amount = 1) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, activity: (message.activity || 0) + amount } : message,
      ),
    );
  }

  function completeProgress(id: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              progress: message.progress?.map((step) => ({ ...step, done: true })),
            }
          : message,
      ),
    );
  }

  async function send(text = draft) {
    const cleanText = text.trim();
    if (busy || (!cleanText && !pendingFile)) return;
    const isFirstMessage = messages.length === 0;

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const file = pendingFile;
    const image = preview || undefined;
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: cleanText, image },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: connection === "ready" ? chat.thinking : chat.connecting,
        streaming: true,
      },
    ]);
    setDraft("");
    setPendingFile(null);
    setPreview(null);
    setBusy(true);

    let renderer: ReturnType<typeof progressiveText> | null = null;
    try {
      const currentSession = await activeSession();
      if (!user) throw new Error("authentication_required");
      const idToken = await user.getIdToken();
      if (isFirstMessage && cleanText) {
        await updateSession(idToken, currentSession, {
          title: cleanText.length > 54 ? `${cleanText.slice(0, 51).trim()}…` : cleanText,
        });
      }
      const controller = new AbortController();
      activeRequest.current = controller;
      let streamedText = "";
      renderer = progressiveText((content) => {
        streamedText = content;
        updateMessage(assistantMessageId, {
          content,
          status: undefined,
          streaming: true,
        });
      });
      let hasSpecialistProgress = false;
      let pendingActivity = 0;

      const toolProgress = (names: string[]) => {
        if (names.includes("food_analysis_agent")) return chat.analysisStarted;
        if (names.includes("research_agent")) return chat.researchStarted;
        if (names.includes("search_reaction_literature")) return chat.checkingReactions;
        if (names.some((name) => name.startsWith("asta"))) return chat.searchingEvidence;
        if (
          names.includes("lookup_openfoodtox") ||
          names.includes("get_pubchem_hazard_summary")
        ) {
          return chat.checkingHazards;
        }
        if (names.includes("lookup_chemical_identity")) return chat.identifyingCompounds;
        if (
          names.includes("get_food_chemical_profile") ||
          names.includes("search_food_compounds")
        ) {
          return chat.mappingCompounds;
        }
        if (names.includes("search_nutrient_retention")) return chat.checkingRetention;
        if (names.includes("solve_food_chemistry")) return chat.solvingChemistry;
        if (names.includes("generate_food_illustration")) return chat.generatingIllustration;
        if (names.includes("finish_task")) return chat.synthesizingEvidence;
        const name = names[0] || "evidence";
        return chat.usingEvidenceTool.replace("{tool}", name.replaceAll("_", " "));
      };

      await streamMessage(
        idToken,
        currentSession,
        { text: cleanText, files: file ? [file] : [] },
        async ({ event, data }) => {
          const author = String(data.author || "");
          const isSpecialist =
            author === "food_analysis_agent" || author === "research_agent";
          if (event === "tool_call") {
            const names = Array.isArray(data.tool_names)
              ? data.tool_names.map((name) => String(name))
              : [];
            hasSpecialistProgress =
              hasSpecialistProgress ||
              isSpecialist ||
              names.includes("food_analysis_agent") ||
              names.includes("research_agent");
            if (hasSpecialistProgress) advanceProgress(assistantMessageId, toolProgress(names));
            return;
          }
          if (event === "tool_result" && (hasSpecialistProgress || isSpecialist)) {
            hasSpecialistProgress = true;
            completeProgress(assistantMessageId);
            return;
          }
          if (event === "state" && (hasSpecialistProgress || isSpecialist)) {
            hasSpecialistProgress = true;
            advanceProgress(assistantMessageId, chat.updatingState);
            return;
          }
          if (event === "agent_progress") {
            if (isSpecialist) hasSpecialistProgress = true;
            const label = isSpecialist
              ? chat.synthesizingEvidence
              : hasSpecialistProgress
                ? chat.composingAnswer
                : chat.understandingRequest;
            advanceProgress(assistantMessageId, label);
            pendingActivity += 1;
            if (pendingActivity >= 8) {
              pulseProgress(assistantMessageId, pendingActivity);
              pendingActivity = 0;
            }
            return;
          }
          if (
            (event === "text_delta" || event === "message") &&
            isSpecialist
          ) {
            hasSpecialistProgress = true;
            advanceProgress(assistantMessageId, chat.synthesizingEvidence);
            return;
          }
          if ((event === "text_delta" || event === "message") && author === "root_agent") {
            const value = String(data.text_delta || "");
            if (!value) return;
            if (hasSpecialistProgress) advanceProgress(assistantMessageId, chat.composingAnswer);
            if (event === "text_delta") renderer?.append(value);
            else renderer?.reconcile(value);
            return;
          }
          if (event === "error") {
            throw new Error("request_failed");
          }
          if (event === "done") {
            streamedText = (await renderer?.finish()) || streamedText;
            if (streamedText) {
              completeProgress(assistantMessageId);
              updateMessage(assistantMessageId, {
                content: streamedText,
                status: undefined,
                streaming: false,
                error: false,
              });
            } else {
              updateMessage(assistantMessageId, {
                content: chat.failed,
                status: undefined,
                streaming: false,
                error: false,
                progress: undefined,
              });
            }
          }
        },
        controller.signal,
      );
    } catch (error) {
      renderer?.cancel();
      if (error instanceof Error && error.name === "AbortError") return;
      updateMessage(assistantMessageId, {
        content: chat.failed,
        status: undefined,
        streaming: false,
        error: false,
        progress: undefined,
      });
    } finally {
      activeRequest.current = null;
      setBusy(false);
      if (user) void refreshSessions();
      textarea.current?.focus();
    }
  }

  async function newConversation() {
    if (busy) activeRequest.current?.abort();
    setBusy(false);
    setConnection("connecting");
    setMessages([]);
    setDraft("");
    setPendingFile(null);
    setPreview(null);

    try {
      if (!user) throw new Error("authentication_required");
      const token = await user.getIdToken();
      const nextSession = await createSession(token, { title: "New conversation" });
      sessionId.current = nextSession;
      setActiveSessionId(nextSession);
      connectionPromise.current = Promise.resolve(nextSession);
      localStorage.setItem(sessionKey(user.uid), nextSession);
      await refreshSessions(token);
      setConnection("ready");
    } catch {
      setConnection("error");
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: chat.newSessionFailed,
          error: false,
        },
      ]);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: chat.imageTooLarge,
          error: false,
        },
      ]);
      return;
    }
    try {
      const inline = await fileToInline(file);
      setPendingFile(inline);
      setPreview(`data:${inline.mime_type};base64,${inline.data}`);
      textarea.current?.focus();
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: chat.failed,
          error: false,
        },
      ]);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const suggestions = [
    ["camera", welcome.scanTitle, welcome.scanDescription, welcome.scanPrompt],
    ["shield", welcome.safetyTitle, welcome.safetyDescription, welcome.safetyPrompt],
    ["chemistry", welcome.chemistryTitle, welcome.chemistryDescription, welcome.chemistryPrompt],
  ] as const;

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Brand name={brand.name} tagline={brand.tagline} />
          <button className="new-chat" onClick={() => void newConversation()} type="button">
            <span className="new-chat-icon"><Icon height={17} name="add" width={17} /></span>
            {sidebar.newChat}
          </button>
        </div>

        <nav aria-label={sidebar.workspace} className="sidebar-nav">
          <p className="nav-label">{sidebar.workspace}</p>
          {navItems.map(([key, icon, href], index) => (
            <Link className={index === 0 ? "nav-item active" : "nav-item"} href={href} key={key}>
              <Icon height={18} name={icon} width={18} />
              {sidebar[key]}
            </Link>
          ))}
        </nav>

        <section className="history">
          <div className="history-title">
            <span>{sidebar.recent}</span>
            <Icon height={15} name="clock" width={15} />
          </div>
          {sessions.length ? sessions.slice(0, 12).map((item) => (
            <button
              className={item.id === activeSessionId ? "history-item active" : "history-item"}
              key={item.id}
              onClick={() => void openConversation(item)}
              type="button"
            >
              <span>{sessionTitle(item)}</span>
              <small>{relativeDate(item.updated_at)}</small>
            </button>
          )) : <p className="history-empty">Your conversations will appear here.</p>}
        </section>

        <div className="sidebar-footer">
          <Link className="nav-item" href="/settings">
            <Icon height={18} name="settings" width={18} />
            {sidebar.settings}
          </Link>
          <div className="profile">
            {user?.photoURL ? (
              <Image alt="" className="avatar-photo" height={34} src={user.photoURL} unoptimized width={34} />
            ) : <span className="avatar">{user?.displayName?.slice(0, 2).toUpperCase() || "HC"}</span>}
            <span><strong>{user?.displayName || profile.name}</strong><small>{user?.email || profile.status}</small></span>
          </div>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="topbar">
          <div className="mobile-brand"><Brand name={brand.name} /></div>
          <div className="page-title">
            <strong>{header.title}</strong>
            <span className={`connection ${connection}`}>
              <i />{connection === "connecting" ? chat.connecting : header.subtitle}
            </span>
          </div>
          <div className="header-actions">
            <Link className="locale-button" href="/">HOME</Link>
            <ThemeToggle label={header.theme} />
            <div className="chat-account" ref={accountMenu}>
              <button
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className="header-account-link"
                onClick={() => setAccountOpen((current) => !current)}
                type="button"
              >
                {user?.photoURL ? (
                  <Image alt="" className="header-avatar photo" height={38} src={user.photoURL} unoptimized width={38} />
                ) : <span className="header-avatar">{user?.displayName?.slice(0, 2).toUpperCase() || "HC"}</span>}
              </button>
              {accountOpen ? <div aria-label="Account menu" className="account-popover chat-account-popover" role="menu">
                <div className="account-popover-identity">
                  {user?.photoURL ? <Image alt="" height={42} src={user.photoURL} unoptimized width={42} /> : <span>{user?.displayName?.slice(0, 1).toUpperCase() || "H"}</span>}
                  <div><small>Signed in as</small><strong>{user?.displayName || profile.name}</strong><small>{user?.email || profile.status}</small></div>
                </div>
                <button className="account-sign-out" onClick={() => void signOut()} role="menuitem" type="button"><span>Sign out</span><b>→</b></button>
              </div> : null}
            </div>
          </div>
        </header>

        <div className="conversation" ref={conversation}>
          {messages.length === 0 ? (
            <section className="welcome">
              <div className="welcome-logo"><Brand name={brand.name} /></div>
              <span className="eyebrow">{welcome.eyebrow}</span>
              <h1>{welcome.title}</h1>
              <p>{welcome.description}</p>

              <div className="suggestion-grid">
                {suggestions.map(([icon, title, description, prompt], index) => (
                  <button
                    className="suggestion-card"
                    key={title}
                    onClick={() => {
                      if (index === 0) fileInput.current?.click();
                      else {
                        setDraft(prompt);
                        textarea.current?.focus();
                      }
                    }}
                    type="button"
                  >
                    <span className={`suggestion-icon ${icon}`}>
                      <Icon height={23} name={icon} width={23} />
                    </span>
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <Icon className="card-arrow" height={18} name="arrow" width={18} />
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div aria-live="polite" className="message-list">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-author">
                    {message.role === "assistant" ? (
                      <Image alt="Hestia" height={30} src="/logo-transparent.webp" width={30} />
                    ) : (
                      <span>{user?.displayName?.slice(0, 2).toUpperCase() || "HC"}</span>
                    )}
                    <strong>{message.role === "assistant" ? chat.assistant : chat.you}</strong>
                  </div>
                  <div className={message.error ? "message-body error" : "message-body"}>
                    {message.image ? (
                      <Image
                        alt={chat.imageReady}
                        className="message-image"
                        height={280}
                        src={message.image}
                        unoptimized
                        width={420}
                      />
                    ) : null}
                    {message.attachments?.map((attachment) => (
                      <PrivateImage
                        alt={attachment.name}
                        className="message-image"
                        height={280}
                        key={attachment.id}
                        src={attachmentUrl(activeSessionId || "", attachment.url)}
                        width={420}
                      />
                    ))}
                    {message.content ? (
                      <MessageMarkdown
                        aiIllustration={chat.aiIllustration}
                        complete={message.role === "assistant" && !message.streaming}
                        content={message.content}
                        sessionId={activeSessionId || ""}
                        sourcesTitle={chat.sourcesUsed}
                      />
                    ) : null}
                    {message.progress?.length ? (
                      <div className="analysis-progress" aria-label={chat.progressLabel}>
                        {message.progress.map((step, index) => (
                          <div className={step.done ? "progress-step done" : "progress-step active"} key={`${step.label}-${index}`}>
                            <span aria-hidden="true">{step.done ? "✓" : ""}</span>
                            <div>
                              {step.label}
                              {!step.done && message.activity ? (
                                <small>{chat.liveUpdates.replace("{count}", String(message.activity))}</small>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {message.status ? <div className="thinking"><span /><span /><span />{message.status}</div> : null}
                    {message.streaming && message.content ? <span className="stream-caret" /> : null}
                  </div>
                </article>
              ))}
              <div ref={messagesEndRef} style={{ height: "1px", width: "100%" }} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {preview ? (
            <div className="attachment-preview">
              <Image alt={chat.imageReady} height={72} src={preview} unoptimized width={72} />
              <span><strong>{pendingFile?.name}</strong><small>{chat.imageReady}</small></span>
              <button
                aria-label={chat.removeImage}
                onClick={() => { setPendingFile(null); setPreview(null); }}
                type="button"
              >×</button>
            </div>
          ) : null}
          <form className="composer" onSubmit={submit}>
            <input accept="image/*" hidden onChange={(event) => void chooseFile(event)} ref={fileInput} type="file" />
            <button
              aria-label={composer.attach}
              className="composer-action"
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              <Icon height={20} name="paperclip" width={20} />
            </button>
            <textarea
              aria-label={composer.placeholder}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={composer.placeholder}
              ref={textarea}
              rows={1}
              value={draft}
            />
            <button
              aria-label={composer.send}
              className="send-button"
              disabled={busy || (!draft.trim() && !pendingFile)}
              type="submit"
            >
              <Icon height={20} name="arrow" width={20} />
            </button>
          </form>
          <p className="disclaimer">{composer.hint}</p>
        </div>
      </section>
    </main>
  );
}
