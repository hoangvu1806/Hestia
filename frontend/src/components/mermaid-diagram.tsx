"use client";

import {
  type ComponentPropsWithoutRef,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";

let renderQueue = Promise.resolve();
const mermaidStart = /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|sankey-beta|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i;

function saferMermaid(source: string) {
  const normalized = source
    .replace(
      /\[(?:<)?([^:\]<>\n]+):((?:FDB|FOOD)\d+)(?:>)?\]/gi,
      (_, name, reference) => `${String(name).trim()} (${String(reference).toUpperCase()})`,
    )
    .replaceAll("\\n", " — ")
    .replaceAll(">=", "≥")
    .replaceAll("<=", "≤")
    .replace(/\|<\s*(?=\d)/g, "|dưới ")
    .replace(/\|>\s*(?=\d)/g, "|trên ")
    .replace(/>\s*(?=\d)/g, "trên ")
    .replace(/<\s*(?=\d)/g, "dưới ");

  const quote = (label: string) => {
    const value = label.trim().replace(/^["']|["']$/g, "").replaceAll('"', "'");
    return `"${value}"`;
  };

  return normalized
    .replace(/(subgraph\s+[A-Za-z_][\w-]*)\s+\[([^\]\r\n]*)\]/g, (_, head, label) => `${head}[${quote(label)}]`)
    .replace(/([A-Za-z_][\w-]*)\[(?!\[)([^\]\r\n]*)\]/g, (_, id, label) => `${id}[${quote(label)}]`)
    .replace(/([A-Za-z_][\w-]*)\{([^}\r\n]*)\}/g, (_, id, label) => `${id}{${quote(label)}}`);
}

function palette(dark: boolean) {
  return dark
    ? {
        background: "#211d24",
        primary: "#3b2928",
        secondary: "#20362d",
        tertiary: "#302941",
        text: "#f7f1ed",
        muted: "#bdb1aa",
        line: "#d47b68",
      }
    : {
        background: "#fffaf7",
        primary: "#fff0eb",
        secondary: "#eaf8f0",
        tertiary: "#f2edfb",
        text: "#2a211e",
        muted: "#776b65",
        line: "#c96e59",
      };
}

function MermaidDiagram({ source }: { source: string }) {
  const id = `hestia-mermaid-${useId().replaceAll(":", "")}`;
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSvg("");

    const task = async () => {
      const mermaid = (await import("mermaid")).default;
      const colors = palette(theme === "dark");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        fontFamily: "Plus Jakarta Sans, Segoe UI, sans-serif",
        flowchart: { curve: "basis", htmlLabels: false, nodeSpacing: 34, rankSpacing: 44 },
        themeVariables: {
          background: colors.background,
          primaryColor: colors.primary,
          primaryTextColor: colors.text,
          primaryBorderColor: colors.primary,
          secondaryColor: colors.secondary,
          secondaryTextColor: colors.text,
          secondaryBorderColor: colors.secondary,
          tertiaryColor: colors.tertiary,
          tertiaryTextColor: colors.text,
          tertiaryBorderColor: colors.tertiary,
          lineColor: colors.line,
          textColor: colors.text,
          mainBkg: colors.primary,
          nodeBorder: colors.primary,
          clusterBkg: colors.tertiary,
          clusterBorder: colors.tertiary,
          edgeLabelBackground: colors.background,
          fontSize: "14px",
        },
        themeCSS: `
          .node rect, .node circle, .node ellipse, .node polygon, .node path {
            stroke-width: 0 !important;
            filter: drop-shadow(0 7px 12px rgba(50, 28, 22, .10));
          }
          .nodeLabel, .edgeLabel, .label { font-weight: 650 !important; }
          .edgePath .path, .flowchart-link { stroke-width: 2px !important; }
          .edgeLabel rect { rx: 8px; ry: 8px; opacity: .96 !important; }
          .cluster rect { stroke-width: 0 !important; rx: 16px; ry: 16px; }
        `,
      });
      const candidates = [source, saferMermaid(source)].filter(
        (candidate, index, items) => items.indexOf(candidate) === index,
      );
      let rendered = "";
      for (const [index, candidate] of candidates.entries()) {
        try {
          rendered = (await mermaid.render(`${id}-${theme}-${index}`, candidate)).svg;
          break;
        } catch {
          // Try the normalized candidate before falling back to source text.
        }
      }
      if (!rendered) throw new Error("diagram_unavailable");
      if (active) setSvg(rendered);
    };

    const queued = renderQueue.then(task, task);
    renderQueue = queued.then(() => undefined, () => undefined);
    queued.catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [id, source, theme]);

  if (failed) {
    return <pre className="mermaid-fallback"><code>{source}</code></pre>;
  }

  return (
    <figure aria-label="Food chemistry pathway" className="mermaid-diagram">
      {svg ? (
        <div className="mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div aria-hidden="true" className="mermaid-loading"><span /><span /><span /></div>
      )}
    </figure>
  );
}

type CodeElement = { className?: string; children?: ReactNode };

export function MarkdownPre({ children, node: _, ...props }: ComponentPropsWithoutRef<"pre"> & { node?: unknown }) {
  if (isValidElement<CodeElement>(children)) {
    const source = String(children.props.children || "").replace(/\n$/, "");
    const explicit = /(?:^|\s)language-mermaid(?:\s|$)/.test(children.props.className || "");
    if (explicit || mermaidStart.test(source)) return <MermaidDiagram source={source} />;
  }
  return <pre {...props}>{children}</pre>;
}
