import { tokens } from "../tokens";

export interface TabProps {
  label: string;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}

export function Tab({ label, active, accentColor, onClick }: TabProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        border: "none",
        borderLeft: `4px solid ${active ? accentColor : "transparent"}`,
        background: active ? tokens.color.surface : "transparent",
        color: tokens.color.ink,
        font: `14px ${tokens.font.body}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
