import type { ReactNode } from "react";

export function SectionHero({ eyebrow, title, copy, aside }: { eyebrow: string; title: string; copy: string; aside?: ReactNode }) {
  return (
    <section className="section-hero site-container">
      <div><span className="site-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
      {aside ? <div className="section-hero-aside">{aside}</div> : null}
    </section>
  );
}
