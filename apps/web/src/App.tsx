import { useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { SectionId } from "@retrorganizer/ui";
import { SECTIONS } from "./routes/sections";
import { ComingSoon } from "./routes/ComingSoon";
import { SectionPlaceholder } from "./routes/SectionPlaceholder";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { GlobalSearchBar } from "./search/GlobalSearchBar";
import { TrashPanel } from "./trash/TrashPanel";
import { CategoryManager } from "./categories/CategoryManager";
import { ReminderHost } from "./reminders/ReminderHost";
import { PushOptIn } from "./notifications/PushOptIn";
import { ChunkErrorBoundary } from "./ChunkErrorBoundary";
import { EventsProvider } from "./calendar/useEvents";

const ContactsModule = lazy(() => import("./contacts/ContactsModule").then((m) => ({ default: m.ContactsModule })));
const DiaryWeek = lazy(() => import("./calendar/DiaryWeek").then((m) => ({ default: m.DiaryWeek })));
const TodoList = lazy(() => import("./tasks/TodoList").then((m) => ({ default: m.TodoList })));
const NotesModule = lazy(() => import("./notes/NotesModule").then((m) => ({ default: m.NotesModule })));

const TAB_ICON: Record<SectionId, string> = {
  diary: "event",
  todo: "fact_check",
  address: "contact_page",
  notepad: "edit_note",
  planner: "calendar_month",
  anniversary: "cake",
  web: "language",
  calls: "call",
};

// Per-tab pastel colours (Material-3 "fixed" tones, per Stitch).
const TAB_BG: Record<SectionId, string> = {
  diary: "bg-tertiary-fixed",
  todo: "bg-secondary-container",
  address: "bg-primary-fixed",
  notepad: "bg-surface-variant",
  planner: "bg-tertiary-fixed",
  anniversary: "bg-secondary-container",
  web: "bg-primary-fixed",
  calls: "bg-surface-variant",
};

// Screen title shown in the app bar (falls back to the tab label).
const SCREEN_TITLE: Partial<Record<SectionId, string>> = {
  diary: "Weekly Planner",
  todo: "Daily Planner",
  address: "Address Book",
  notepad: "Notepad",
};

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className ?? ""}`} aria-hidden>{name}</span>;
}

export function App() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [trashOpen, setTrashOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <div className="p-6 font-body-md">Chargement…</div>;
  if (!user) return <LoginScreen />;

  const active = SECTIONS.find((s) => location.pathname.startsWith(s.path)) ?? SECTIONS[0]!;

  return (
    <EventsProvider>
      <div className="min-h-screen flex flex-col items-center justify-start p-2 sm:p-4">
        <div className="relative w-full max-w-md h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] flex bg-white shadow-2xl rounded-sm overflow-hidden border-[6px] border-secondary">
          {/* Left gutter: binder rings + punched holes */}
          <div className="w-10 shrink-0 bg-surface-dim relative binder-rings border-r border-outline-variant">
            <div className="absolute inset-y-0 left-[-4px] flex flex-col justify-around py-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-full bg-black/40 shadow-inner" />
              ))}
            </div>
          </div>

          {/* Central page */}
          <main className="flex-1 min-w-0 paper-texture flex flex-col relative z-10">
            {/* Top app bar */}
            <header className="flex justify-between items-center px-edge-margin py-stack-gap border-b-[3px] border-double border-outline-variant bg-surface-container-low relative">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  aria-label="Menu"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="text-on-surface p-1 leading-none hover:bg-surface-container-high rounded"
                >
                  <Icon name="menu" />
                </button>
                <h1 className="font-headline-md text-headline-md text-on-surface truncate">{SCREEN_TITLE[active.id] ?? active.label}</h1>
              </div>
              <button
                type="button"
                className="bg-secondary-container border-2 border-t-white border-l-white border-b-secondary border-r-secondary px-3 py-0.5 font-label-sm text-label-sm text-on-surface active:border-t-secondary active:border-l-secondary active:border-b-white active:border-r-white"
              >
                SAVE
              </button>

              {menuOpen && (
                <div className="absolute left-2 top-full mt-1 z-50 bg-surface-container-lowest border border-outline shadow-lg rounded-lg py-1 flex flex-col min-w-44 font-body-md text-on-surface">
                  <button type="button" className="text-left px-3 py-1.5 hover:bg-surface-container-high" onClick={() => { setCategoriesOpen(true); setMenuOpen(false); }}>Catégories</button>
                  <button type="button" className="text-left px-3 py-1.5 hover:bg-surface-container-high" onClick={() => { setTrashOpen(true); setMenuOpen(false); }}>Corbeille</button>
                  <div className="px-3 py-1.5"><PushOptIn /></div>
                  <button type="button" className="text-left px-3 py-1.5 hover:bg-surface-container-high" onClick={() => { void signOut(); setMenuOpen(false); }}>Déconnexion</button>
                </div>
              )}
            </header>

            {/* Search toolbar */}
            <div className="px-4 py-2 border-b border-outline-variant flex gap-2 items-center bg-surface-container-lowest/50">
              <span className="material-symbols-outlined text-outline text-base" aria-hidden>search</span>
              <div className="flex-1 min-w-0 legacy-content">
                <GlobalSearchBar />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 legacy-content">
              <ChunkErrorBoundary>
                <Suspense fallback={<div className="p-4 font-body-md text-on-surface-variant">Chargement…</div>}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/diary" replace />} />
                    {SECTIONS.map((s) => (
                      <Route
                        key={s.id}
                        path={s.path}
                        element={
                          s.id === "diary"
                            ? <DiaryWeek />
                            : s.id === "todo"
                              ? <TodoList />
                              : s.id === "address"
                                ? <ContactsModule />
                                : s.id === "notepad"
                                  ? <NotesModule />
                                  : s.mvp
                                    ? <SectionPlaceholder label={s.label} />
                                    : <ComingSoon label={s.label} />
                        }
                      />
                    ))}
                    <Route path="*" element={<Navigate to="/diary" replace />} />
                  </Routes>
                </Suspense>
              </ChunkErrorBoundary>
            </div>

            {/* Bottom command nav */}
            <nav className="h-12 shrink-0 flex justify-around items-center border-t border-outline bg-surface-container-highest shadow-inner">
              <button type="button" aria-label="Enregistrer" className="flex-1 h-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high">
                <Icon name="save" />
              </button>
              <button type="button" aria-label="Imprimer" onClick={() => window.print()} className="flex-1 h-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high">
                <Icon name="print" />
              </button>
              <button type="button" aria-label="Supprimer" disabled className="flex-1 h-full flex items-center justify-center text-on-surface-variant/40">
                <Icon name="delete" />
              </button>
              <button type="button" aria-label="Rechercher" onClick={() => document.getElementById("global-search-input")?.focus()} className="flex-1 h-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high">
                <Icon name="search" />
              </button>
            </nav>
          </main>

          {/* Right vertical tabs: top-aligned, per-tab pastel, active protrudes over the page */}
          <nav role="tablist" aria-orientation="vertical" className="w-12 sm:w-14 shrink-0 flex flex-col gap-1 pt-3 bg-surface-dim">
            {SECTIONS.map((s) => {
              const isActive = location.pathname.startsWith(s.path);
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => navigate(s.path)}
                  className={[
                    "h-[88px] flex flex-col items-center justify-center gap-1 border-y border-y-outline-variant transition-all",
                    TAB_BG[s.id],
                    isActive
                      ? "border-l-4 border-l-primary text-primary -ml-2 shadow-md relative z-30 rounded-l-md"
                      : "border-l border-l-transparent text-on-surface-variant/70 hover:brightness-105",
                  ].join(" ")}
                >
                  <Icon name={TAB_ICON[s.id]} className="text-[20px]" />
                  <span className="tab-vert font-label-sm text-[9px] uppercase tracking-tighter">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}
        {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
        <ReminderHost />
      </div>
    </EventsProvider>
  );
}
