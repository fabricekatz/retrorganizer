import { useEffect, useState } from "react";
import { tokens, moduleAccent } from "@retrorganizer/ui";
import { emptyNoteDraft, draftFromNote, type Note, type NoteDraft } from "@retrorganizer/core";
import { useNotes } from "./useNotes";
import { NoteEditor } from "./NoteEditor";

export function NotesModule() {
  const { sections, notes, loading, error, createSection, createNote, updateNote, removeNote } = useNotes();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);

  // auto-select the first section once loaded
  useEffect(() => {
    if (selectedSectionId === null && sections.length > 0) setSelectedSectionId(sections[0]!.id);
  }, [sections, selectedSectionId]);

  const sectionNotes = notes.filter((n) => n.sectionId === selectedSectionId);

  function openNote(n: Note) {
    setSelectedNoteId(n.id);
    setDraft(draftFromNote(n));
  }
  async function newNote() {
    if (!selectedSectionId) return;
    await createNote(emptyNoteDraft(selectedSectionId));
  }
  async function addSection() {
    const name = window.prompt("Nom du carnet ?");
    if (name && name.trim() !== "") await createSection({ name: name.trim(), order: sections.length });
  }
  async function save() {
    if (!selectedNoteId || !draft) return;
    await updateNote(selectedNoteId, { title: draft.title, body: draft.body });
  }
  async function del() {
    if (!selectedNoteId) return;
    await removeNote(selectedNoteId);
    setSelectedNoteId(null);
    setDraft(null);
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  return (
    <div style={{ display: "flex", height: "100%", font: `13px ${tokens.font.body}` }}>
      <nav style={{ width: 140, borderRight: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.space.xs }}>
          <strong>Carnets</strong>
          <button type="button" onClick={addSection} aria-label="Ajouter un carnet">+ Carnet</button>
        </div>
        {sections.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSelectedSectionId(s.id); setSelectedNoteId(null); setDraft(null); }}
            style={{ display: "block", width: "100%", textAlign: "left", border: "none",
              borderLeft: `3px solid ${selectedSectionId === s.id ? moduleAccent.notepad : "transparent"}`,
              background: "transparent", cursor: "pointer", padding: tokens.space.xs, color: tokens.color.ink }}>
            {s.name}
          </button>
        ))}
      </nav>

      <div style={{ width: 180, borderRight: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.space.xs }}>
          <strong>Notes</strong>
          {selectedSectionId && <button type="button" onClick={newNote}>+ Note</button>}
        </div>
        {sectionNotes.map((n) => (
          <button key={n.id} type="button" onClick={() => openNote(n)}
            style={{ display: "block", width: "100%", textAlign: "left", border: "none",
              borderBottom: `1px solid ${tokens.color.line}`, background: selectedNoteId === n.id ? tokens.color.surface : "transparent",
              cursor: "pointer", padding: tokens.space.xs, color: tokens.color.ink }}>
            {n.title || "(sans titre)"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: tokens.space.sm }}>
        {error && <p role="alert" style={{ color: "#a8431f" }}>{error}</p>}
        {draft && selectedNoteId ? (
          <div style={{ display: "grid", gap: tokens.space.sm }}>
            <input aria-label="Titre de la note" value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              style={{ font: `16px ${tokens.font.body}` }} placeholder="Titre" />
            <NoteEditor key={selectedNoteId} value={draft.body} onChange={(body) => setDraft((d) => (d ? { ...d, body } : d))} />
            <div style={{ display: "flex", gap: tokens.space.sm }}>
              <button type="button" onClick={save}>Enregistrer</button>
              <button type="button" onClick={del}>Supprimer</button>
            </div>
          </div>
        ) : (
          <p style={{ color: tokens.color.muted }}>Sélectionnez ou créez une note.</p>
        )}
      </div>
    </div>
  );
}
