const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
]);

function isTrackingParameter(name: string): boolean {
  return name.startsWith("utm_") || TRACKING_PARAMETERS.has(name);
}

export function isSupportedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParameter(name)) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString().replace(/\/$/, "");
}

function matchesDomain(hostname: string, pattern: string): boolean {
  const normalizedPattern = pattern.trim().toLowerCase();
  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  return hostname === normalizedPattern;
}

export function isBlockedUrl(value: string, patterns: string[]): boolean {
  if (!isSupportedUrl(value)) {
    return true;
  }

  const hostname = new URL(value).hostname.toLowerCase();
  return patterns.some((pattern) => matchesDomain(hostname, pattern));
}
