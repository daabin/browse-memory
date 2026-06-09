import { BookOpen, MessageCircle } from "lucide-react";

export type PanelMode = "memory" | "conversation";

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PanelMode;
  onChange(mode: PanelMode): void;
}) {
  return (
    <nav className="mode-switch" aria-label="主导航">
      <button
        className={mode === "memory" ? "active" : ""}
        onClick={() => onChange("memory")}
        type="button"
      >
        <BookOpen size={18} />
        记忆
      </button>
      <button
        className={mode === "conversation" ? "active" : ""}
        onClick={() => onChange("conversation")}
        type="button"
      >
        <MessageCircle size={18} />
        对话
      </button>
    </nav>
  );
}
