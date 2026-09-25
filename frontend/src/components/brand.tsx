import Image from "next/image";

export function Brand({ name, tagline }: { name: string; tagline?: string }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Image alt="Hestia" height={42} priority src="/logo-transparent.png" width={42} />
      </span>
      <span className="brand-copy">
        <strong>{name}</strong>
        {tagline ? <small>{tagline}</small> : null}
      </span>
    </div>
  );
}
