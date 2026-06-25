import { tokens } from "@retrorganizer/ui";

export function SectionPlaceholder({ label }: { label: string }) {
  return (
    <div style={{ padding: tokens.space.xl }}>
      <h2 style={{ color: tokens.color.ink }}>{label}</h2>
      <p style={{ color: tokens.color.muted }}>Module en cours de construction (Phase suivante).</p>
    </div>
  );
}
