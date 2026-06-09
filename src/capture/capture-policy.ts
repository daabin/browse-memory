import type { AppSettings } from "../shared/types";
import { isBlockedUrl, isSupportedUrl } from "../shared/url-policy";

export interface CaptureCandidate {
  url: string;
  durationSeconds: number;
  incognito: boolean;
}

export function shouldCapture(
  candidate: CaptureCandidate,
  settings: AppSettings,
): boolean {
  return (
    !candidate.incognito &&
    candidate.durationSeconds >= settings.minimumReadSeconds &&
    isSupportedUrl(candidate.url) &&
    !isBlockedUrl(candidate.url, settings.blacklistPatterns)
  );
}
