import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { emptyDoc, emptyNoteDraft } from "@retrorganizer/core";
import { useNotes } from "./useNotes";

export function NotePad() {
  const { sections, notes, loading, createSection, createNote, updateNote, removeNote } = useNotes();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [chars, setChars] = useState(0);
  const [pagesOpen, setPagesOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef = useRef(title);
  titleRef.current = title;
  const noteIdRef = useRef(selectedNoteId);
  noteIdRef.current = selectedNoteId;

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId]);

  function scheduleSave() {
    const id = noteIdRef.current;
    if (!id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateNote(id, { title: titleRef.current, body: editorRef.current?.getJSON() });
    }, 600);
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: emptyDoc(),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setChars(editor.getText().length);
      scheduleSave();
    },
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // auto-select first section, then its first note
  useEffect(() => {
    if (selectedSectionId === null && sections.length > 0) setSelectedSectionId(sections[0]!.id);
  }, [sections, selectedSectionId]);
  useEffect(() => {
    if (selectedNoteId === null) {
      const first = notes.find((n) => n.sectionId === selectedSectionId);
      if (first) setSelectedNoteId(first.id);
    }
  }, [notes, selectedSectionId, selectedNoteId]);

  // load the selected note into the editor + title
  useEffect(() => {
    if (!editor || !selectedNote) return;
    setTitle(selectedNote.title);
    editor.commands.setContent((selectedNote.body as object) ?? emptyDoc(), { emitUpdate: false });
    setChars(editor.getText().length);
    // eslint-disable-line — only re-run when the note id changes
  }, [editor, selectedNoteId]);

  function onTitleChange(v: string) {
    setTitle(v);
    scheduleSave();
  }
  async function addSection() {
    const name = window.prompt("Nom du carnet ?");
    if (name && name.trim() !== "") await createSection({ name: name.trim(), order: sections.length });
  }
  async function addNote() {
    if (!selectedSectionId) return;
    await createNote(emptyNoteDraft(selectedSectionId));
  }

  const dateLabel = selectedNote
    ? new Date(selectedNote.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const tbtn = (icon: string, label: string, active: boolean, action: () => void) => (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
      className={`p-1 retro-outset bg-surface-container hover:bg-surface-container-high active:retro-inset ${active ? "text-primary" : "text-on-surface"}`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden>{icon}</span>
    </button>
  );

  if (loading) return <p className="p-4 italic text-on-surface-variant">Chargement…</p>;

  return (
    <div className="flex flex-col min-h-full -m-4">
      {/* Retro formatting toolbar */}
      <nav className="bg-surface-variant px-3 py-2 flex items-center gap-3 border-b border-outline-variant shadow-sm">
        <button type="button" onClick={() => setPagesOpen((o) => !o)} className="flex items-center gap-1 font-label-sm text-label-sm uppercase text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]" aria-hidden>menu_book</span>
          Pages
        </button>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex gap-1">
          {tbtn("format_bold", "Gras", !!editor?.isActive("bold"), () => editor?.chain().focus().toggleBold().run())}
          {tbtn("format_italic", "Italique", !!editor?.isActive("italic"), () => editor?.chain().focus().toggleItalic().run())}
          {tbtn("title", "Titre", !!editor?.isActive("heading", { level: 2 }), () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
        </div>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex gap-1">
          {tbtn("format_list_bulleted", "Liste à puces", !!editor?.isActive("bulletList"), () => editor?.chain().focus().toggleBulletList().run())}
          {tbtn("format_list_numbered", "Liste numérotée", !!editor?.isActive("orderedList"), () => editor?.chain().focus().toggleOrderedList().run())}
        </div>
        <span className="ml-auto font-mono-data text-label-sm opacity-60">CH: {chars}</span>
      </nav>

      {/* Writing surface */}
      <main className="flex-1 ruled-paper p-6 relative">
        {selectedNote ? (
          <>
            <div className="mb-6 border-b-2 border-primary/30 pb-3">
              <div className="flex justify-between items-end mb-1">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary/70">Sujet</span>
                <span className="font-mono-data text-label-sm text-outline">{dateLabel}</span>
              </div>
              <input
                className="w-full bg-transparent border-none font-headline-lg text-headline-lg text-on-surface focus:outline-none p-0"
                placeholder="Titre…"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                aria-label="Titre de la note"
              />
            </div>
            <div className="font-body-lg text-body-lg text-on-surface leading-[24px] [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_h2]:font-headline-md [&_h2]:text-headline-md">
              <EditorContent editor={editor} />
            </div>
            <button type="button" onClick={async () => { await removeNote(selectedNote.id); setSelectedNoteId(null); }} className="mt-6 font-label-sm text-label-sm uppercase text-error/80">
              Supprimer la note
            </button>
          </>
        ) : (
          <p className="italic text-on-surface-variant">
            {sections.length === 0 ? "Créez un carnet pour commencer." : "Sélectionnez ou créez une page."}
          </p>
        )}
      </main>

      {/* Pages drawer */}
      {pagesOpen && (
        <div className="fixed inset-0 z-40 flex bg-black/20" onClick={() => setPagesOpen(false)}>
          <div className="ml-auto h-full w-64 bg-surface-container-lowest border-l border-outline-variant shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 bg-secondary-container text-on-secondary-container font-label-sm uppercase tracking-widest border-b border-outline-variant flex justify-between items-center">
              <span>Pages</span>
              <button type="button" aria-label="Nouvelle page" onClick={() => void addNote()}>
                <span className="material-symbols-outlined text-sm" aria-hidden>add</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sections.map((s) => (
                <div key={s.id}>
                  <button type="button" onClick={() => setSelectedSectionId(s.id)} className={`w-full text-left px-3 py-1.5 font-label-sm text-label-sm uppercase ${selectedSectionId === s.id ? "text-primary" : "text-on-surface-variant"}`}>
                    {s.name}
                  </button>
                  {notes.filter((n) => n.sectionId === s.id).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => { setSelectedSectionId(s.id); setSelectedNoteId(n.id); setPagesOpen(false); }}
                      className={`w-full text-left px-3 py-2 border-b border-outline-variant flex items-center gap-2 text-body-md ${selectedNoteId === n.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-surface-container-high"}`}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden>description</span>
                      <span className="truncate">{n.title || "(sans titre)"}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void addSection()} className="p-3 border-t border-outline-variant text-left font-label-sm text-label-sm uppercase text-on-surface-variant hover:bg-surface-container-high">
              + Carnet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
