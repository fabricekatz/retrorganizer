import { tokens } from "@retrorganizer/ui";

export function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ padding: tokens.space.xl, color: tokens.color.muted }}>
      <h2 style={{ color: tokens.color.ink }}>{label}</h2>
      <p>Bientôt disponible.</p>
    </div>
  );
}
