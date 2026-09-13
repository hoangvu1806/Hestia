"use client";

import Image from "next/image";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Brand } from "./brand";
import { Icon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { MarkdownPre } from "./mermaid-diagram";
import { ThemeToggle } from "./theme-toggle";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  browserIdentity,
  createSession,
  ensureSession,
  fileToInline,
  type InlineFile,
  streamMessage,
} from "@/lib/hestia-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  status?: string;
  streaming?: boolean;
  error?: boolean;
  progress?: Array<{ label: string; done: boolean }>;
  activity?: number;
};

const navItems = [
  ["chat", "chat"],
  ["ingredients", "ingredients"],
  ["saved", "bookmark"],
] as const;

const sessionKey = "hestia-session-id";
const foodbTag = /\[(?:<)?([^:\]<>\n]+):(FDB\d+)(?:>)?\]/gi;
const foodbFoodTag = /\[(?:<)?([^:\]<>\n]+):(FOOD\d+)(?:>)?\]/gi;
const markdownCode = /(```[\s\S]*?```|`[^`\n]+`)/g;
const duplicatedMathOpen = /\$\s+\$(?=\s*\\(?:le|ge|lt|gt|approx|sim|pm|times|frac|text|circ))/g;

function decorateFoodbTags(markdown: string) {
  return markdown
    .split(markdownCode)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(duplicatedMathOpen, "$")
            .replace(foodbTag, (_, name: string, id: string) =>
              `[${name.trim()}](https://foodb.ca/compounds/${id.toUpperCase()} "hestia-foodb")`,
            )
            .replace(foodbFoodTag, (_, name: string, id: string) =>
              `[${name.trim()}](https://foodb.ca/foods/${id.toUpperCase()} "hestia-food")`,
            ),
    )
    .join("");
}

function FoodbCompound({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const imageUrl = `https://foodb.ca/structures/${id}/image.svg`;

  return (
    <span
      className={open ? "compound-reference open" : "compound-reference"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-expanded={open}
        className="compound-chip"
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        type="button"
      >
        {name}
      </button>
      <span aria-label={`${name} ${id}`} className="compound-popover" role="tooltip">
        <span className="compound-structure">
          <Image alt={`Chemical structure of ${name}`} height={102} src={imageUrl} unoptimized width={158} />
        </span>
        <span className="compound-meta">
          <strong>{name}</strong>
          <small>{id}</small>
        </span>
      </span>
    </span>
  );
}

function FoodbFood({ id, name }: { id: string; name: string }) {
  return (
    <a
      className="food-reference"
      href={`https://foodb.ca/foods/${id}`}
      rel="noreferrer"
      target="_blank"
      title={`${id} · FooDB food`}
    >
      {name}
    </a>
  );
}

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

export function AppShell({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const { brand, chat, composer, header, profile, sidebar, welcome } = dictionary;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<InlineFile | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "ready" | "error">(
    "connecting",
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = useRef<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const connectionPromise = useRef<Promise<string> | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = browserIdentity();
    const storedSession = localStorage.getItem(sessionKey);
    userId.current = id;
    const pending = ensureSession(id, storedSession);
    connectionPromise.current = pending;
    let active = true;

    pending
      .then((resolved) => {
        sessionId.current = resolved;
        localStorage.setItem(sessionKey, resolved);
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
  }, []);

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

    const id = userId.current || browserIdentity();
    userId.current = id;
    setConnection("connecting");
    const pending = ensureSession(id, localStorage.getItem(sessionKey));
    connectionPromise.current = pending;
    try {
      const resolved = await pending;
      sessionId.current = resolved;
      localStorage.setItem(sessionKey, resolved);
      setConnection("ready");
      return resolved;
    } catch (error) {
      connectionPromise.current = null;
      setConnection("error");
      throw error;
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
      const currentUser = userId.current || browserIdentity();
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
        if (names.includes("finish_task")) return chat.synthesizingEvidence;
        const name = names[0] || "evidence";
        return chat.usingEvidenceTool.replace("{tool}", name.replaceAll("_", " "));
      };

      await streamMessage(
        currentUser,
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
      const currentUser = userId.current || browserIdentity();
      userId.current = currentUser;
      const nextSession = await createSession(currentUser);
      sessionId.current = nextSession;
      connectionPromise.current = Promise.resolve(nextSession);
      localStorage.setItem(sessionKey, nextSession);
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
          {navItems.map(([key, icon], index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={key} type="button">
              <Icon height={18} name={icon} width={18} />
              {sidebar[key]}
            </button>
          ))}
        </nav>

        <section className="history">
          <div className="history-title">
            <span>{sidebar.recent}</span>
            <Icon height={15} name="clock" width={15} />
          </div>
          {[sidebar.historyOne, sidebar.historyTwo, sidebar.historyThree].map((item, index) => (
            <button className="history-item" key={item} type="button">
              <span>{item}</span>
              <small>{index === 0 ? "Today" : index === 1 ? "Yesterday" : "May 12"}</small>
            </button>
          ))}
        </section>

        <div className="sidebar-footer">
          <button className="nav-item" type="button">
            <Icon height={18} name="settings" width={18} />
            {sidebar.settings}
          </button>
          <div className="profile">
            <span className="avatar">HC</span>
            <span><strong>{profile.name}</strong><small>{profile.status}</small></span>
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
            <LocaleSwitcher label={header.language} locale={locale} />
            <ThemeToggle label={header.theme} />
            <span className="header-avatar">HC</span>
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
                      <Image alt="Hestia" height={30} src="/logo.png" width={30} />
                    ) : (
                      <span>HC</span>
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
                    {message.content ? (
                      <div className="message-text">
                        <ReactMarkdown
                          components={{
                            pre: MarkdownPre,
                            a: ({ children, href, title }) => {
                              const compound = title === "hestia-foodb"
                                ? href?.match(/^https:\/\/foodb\.ca\/compounds\/(FDB\d+)$/i)
                                : null;
                              const food = title === "hestia-food"
                                ? href?.match(/^https:\/\/foodb\.ca\/foods\/(FOOD\d+)$/i)
                                : null;
                              if (compound) {
                                return <FoodbCompound id={compound[1].toUpperCase()} name={String(children)} />;
                              }
                              if (food) {
                                return <FoodbFood id={food[1].toUpperCase()} name={String(children)} />;
                              }
                              return <a href={href} rel="noreferrer" target="_blank">{children}</a>;
                            },
                          }}
                          rehypePlugins={[[rehypeKatex, { output: "htmlAndMathml", strict: false }]]}
                          remarkPlugins={[remarkGfm, remarkMath]}
                          skipHtml
                        >
                          {decorateFoodbTags(message.content)}
                        </ReactMarkdown>
                      </div>
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
