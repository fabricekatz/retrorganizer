import { useMemo, useState } from "react";
import { filterBookmarks, sortBookmarks, draftFromBookmark, type BookmarkDraft } from "@retrorganizer/core";
import { useBookmarks } from "./useBookmarks";
import { BookmarkForm } from "./BookmarkForm";

export function WebLinks() {
  const { bookmarks, create, update, remove } = useBookmarks();
  const [editing, setEditing] = useState<{ draft: BookmarkDraft | undefined; id: string | null } | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => sortBookmarks(filterBookmarks(bookmarks, query)), [bookmarks, query]);

  async function onSubmit(draft: BookmarkDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <BookmarkForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-body-md text-on-surface">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary" aria-hidden>language</span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface truncate">Liens web</h1>
        </div>
        <span className="font-mono-data text-mono-data text-outline shrink-0">SEC: WEB_01</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined text-outline text-base absolute left-1 top-1/2 -translate-y-1/2" aria-hidden>search</span>
          <input aria-label="Rechercher un lien" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…" className="w-full pl-7 pr-2 py-1 bg-transparent border-b border-outline italic focus:outline-none" />
        </div>
        <button type="button" aria-label="Nouveau lien" onClick={() => setEditing({ draft: undefined, id: null })}
          className="flex items-center gap-1 px-2 py-1 border border-outline bg-primary text-on-primary retro-outset active:retro-inset font-label-sm text-label-sm">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add_link</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun lien</p>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <div key={b.id} className="border border-outline-variant p-3 bg-white/50">
              <div className="flex items-start justify-between gap-2">
                <a href={b.url} target="_blank" rel="noreferrer" className="font-headline-md text-headline-md text-primary truncate">{b.title}</a>
                <button type="button" aria-label={`Modifier ${b.title}`} onClick={() => setEditing({ draft: draftFromBookmark(b), id: b.id })}
                  className="material-symbols-outlined text-outline hover:text-primary text-[18px] shrink-0">edit</button>
              </div>
              <div className="font-mono-data text-mono-data text-on-surface-variant truncate">{b.url}</div>
              {b.description && <p className="text-body-md text-on-surface-variant mt-1">{b.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
