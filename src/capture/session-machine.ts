export interface ReadingSession {
  tabId: number;
  url: string;
  title: string;
  durationSeconds: number;
  active: boolean;
  lastActiveAt: number;
}

export type SessionEvent =
  | { type: "TICK"; at: number }
  | { type: "SET_ACTIVE"; active: boolean; at: number }
  | { type: "NAVIGATE"; url: string; title: string; at: number };

export function createSession(
  tabId: number,
  url: string,
  title: string,
  at: number,
): ReadingSession {
  return {
    tabId,
    url,
    title,
    durationSeconds: 0,
    active: true,
    lastActiveAt: at,
  };
}

function accrue(session: ReadingSession, at: number): ReadingSession {
  if (!session.active || at <= session.lastActiveAt) {
    return session;
  }
  return {
    ...session,
    durationSeconds:
      session.durationSeconds + (at - session.lastActiveAt) / 1_000,
    lastActiveAt: at,
  };
}

export function transitionSession(
  session: ReadingSession,
  event: SessionEvent,
): ReadingSession {
  if (event.type === "TICK") {
    return accrue(session, event.at);
  }

  if (event.type === "SET_ACTIVE") {
    const accrued = accrue(session, event.at);
    return {
      ...accrued,
      active: event.active,
      lastActiveAt: event.at,
    };
  }

  return {
    tabId: session.tabId,
    url: event.url,
    title: event.title,
    durationSeconds: 0,
    active: session.active,
    lastActiveAt: event.at,
  };
}
