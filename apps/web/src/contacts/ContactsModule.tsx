import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  filterContacts, sortContacts, draftFromContact,
  type Contact, type ContactDraft,
} from "@retrorganizer/core";
import { useContacts } from "./useContacts";
import { useCategories } from "../categories/useCategories";
import { ContactList, type SortKey } from "./ContactList";
import { ContactForm } from "./ContactForm";
import { ImportExportBar } from "./ImportExportBar";

export function ContactsModule() {
  const { contacts, loading, error, create, update, remove } = useContacts();
  const { categories } = useCategories();
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const visible = useMemo(
    () => sortContacts(filterContacts(contacts, query), sortKey),
    [contacts, query, sortKey],
  );

  async function onSubmit(draft: ContactDraft) {
    if (selected) await update(selected.id, draft);
    else await create(draft);
    setMode("list");
    setSelected(null);
  }

  async function onImport(drafts: ContactDraft[]) {
    for (const d of drafts) await create(d);
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  return (
    <div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      {mode === "list" ? (
        <>
          <ImportExportBar contacts={contacts} onImport={onImport} />
          <ContactList
            contacts={visible}
            categories={categories}
            onSelect={(c) => { setSelected(c); setMode("edit"); }}
            onNew={() => { setSelected(null); setMode("edit"); }}
            query={query} onQueryChange={setQuery}
            sortKey={sortKey} onSortKeyChange={setSortKey}
          />
        </>
      ) : (
        <div>
          <ContactForm
            initial={selected ? draftFromContact(selected) : undefined}
            onSubmit={onSubmit}
            onCancel={() => { setMode("list"); setSelected(null); }}
          />
          {selected && (
            <button type="button" style={{ margin: tokens.space.md }}
              onClick={async () => { await remove(selected.id); setMode("list"); setSelected(null); }}>
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
