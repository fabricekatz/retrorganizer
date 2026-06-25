import { useState } from "react";
import { tokens } from "@retrorganizer/ui";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await (mode === "in" ? signInEmail(email, pw) : signUpEmail(email, pw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de connexion");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "10vh auto", font: `14px ${tokens.font.body}` }}>
      <h1 style={{ color: tokens.color.ink }}>Retrorganizer</h1>
      <form onSubmit={submit}>
        <input aria-label="Email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="email"
          style={{ display: "block", width: "100%", marginBottom: tokens.space.sm }} />
        <input aria-label="Mot de passe" type="password" value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="mot de passe"
          style={{ display: "block", width: "100%", marginBottom: tokens.space.sm }} />
        <button type="submit">{mode === "in" ? "Se connecter" : "Créer un compte"}</button>
      </form>
      <button onClick={() => signInGoogle()} style={{ marginTop: tokens.space.sm }}>
        Continuer avec Google
      </button>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")}
        style={{ marginTop: tokens.space.sm, background: "none", border: "none", color: tokens.color.muted, cursor: "pointer" }}>
        {mode === "in" ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
      </button>
      {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
    </div>
  );
}
