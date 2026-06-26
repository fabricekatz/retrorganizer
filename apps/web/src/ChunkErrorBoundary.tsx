import { Component, type ReactNode } from "react";
import { tokens } from "@retrorganizer/ui";

interface Props { children: ReactNode; }
interface State { failed: boolean; }

// Catches a failed lazy-chunk import (e.g. a stale chunk 404 after a redeploy)
// and offers a reload instead of crashing to a blank screen.
export class ChunkErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <div role="alert" style={{ padding: tokens.space.lg, font: `13px ${tokens.font.body}`, color: tokens.color.ink }}>
          <p>Échec du chargement de cette section.</p>
          <button type="button" onClick={() => window.location.reload()}>Recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}
