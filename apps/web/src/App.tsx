import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Tab, tokens, moduleAccent } from "@retrorganizer/ui";
import { SECTIONS } from "./routes/sections";
import { ComingSoon } from "./routes/ComingSoon";
import { SectionPlaceholder } from "./routes/SectionPlaceholder";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { ContactsModule } from "./contacts/ContactsModule";
import { CalendarModule } from "./calendar/CalendarModule";
import { TasksModule } from "./tasks/TasksModule";

export function App() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <div style={{ padding: tokens.space.xl }}>Chargement…</div>;
  if (!user) return <LoginScreen />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: tokens.color.paper }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${tokens.space.xs}px ${tokens.space.md}px`, borderBottom: `1px solid ${tokens.color.line}`,
        font: `13px ${tokens.font.body}` }}>
        <strong style={{ color: tokens.color.ink }}>Retrorganizer</strong>
        <button onClick={() => signOut()}>Déconnexion</button>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav role="tablist" aria-orientation="vertical"
          style={{ width: 160, borderRight: `1px solid ${tokens.color.line}`, background: tokens.color.paper }}>
          {SECTIONS.map((s) => (
            <Tab key={s.id} label={s.label} accentColor={moduleAccent[s.id]}
              active={location.pathname.startsWith(s.path)} onClick={() => navigate(s.path)} />
          ))}
        </nav>

        <main style={{ flex: 1, overflow: "auto", background: tokens.color.surface,
          margin: tokens.space.md, border: `1px solid ${tokens.color.line}`, borderRadius: tokens.radius.md }}>
          <Routes>
            <Route path="/" element={<Navigate to="/diary" replace />} />
            {SECTIONS.map((s) => (
              <Route key={s.id} path={s.path}
                element={
                  s.id === "diary"
                    ? <CalendarModule />
                    : s.id === "todo"
                      ? <TasksModule />
                      : s.id === "address"
                        ? <ContactsModule />
                        : s.mvp
                          ? <SectionPlaceholder label={s.label} />
                          : <ComingSoon label={s.label} />
                } />
            ))}
            <Route path="*" element={<Navigate to="/diary" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
