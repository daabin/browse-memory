function domainHue(domain: string): number {
  let hash = 0;
  for (const character of domain) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function DomainIcon({ domain }: { domain: string }) {
  const label = domain.replace(/^www\./, "").charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="domain-monogram"
      style={{ "--domain-hue": domainHue(domain) } as React.CSSProperties}
    >
      {label}
    </span>
  );
}
