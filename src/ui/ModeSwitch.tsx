import { BookOpen, MessageCircle } from "lucide-react";

import { useT } from "../i18n";

export type PanelMode = "memory" | "conversation";

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PanelMode;
  onChange(mode: PanelMode): void;
}) {
  const t = useT();
  return (
    <nav className="mode-switch" aria-label={t("sidepanel.navLabel")}>
      <button
        className={mode === "memory" ? "active" : ""}
        onClick={() => onChange("memory")}
        type="button"
      >
        <BookOpen size={18} />
        {t("sidepanel.memory")}
      </button>
      <button
        className={mode === "conversation" ? "active" : ""}
        onClick={() => onChange("conversation")}
        type="button"
      >
        <MessageCircle size={18} />
        {t("sidepanel.conversation")}
      </button>
    </nav>
  );
}
