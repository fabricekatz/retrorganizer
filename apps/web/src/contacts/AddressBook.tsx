import { useMemo, useState } from "react";
import {
  filterContacts, sortContacts, draftFromContact,
  type Contact, type ContactDraft,
} from "@retrorganizer/core";
import { useContacts } from "./useContacts";
import { ContactForm } from "./ContactForm";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function displayedName(c: Contact): string {
  if (c.lastName && c.firstName) return `${c.lastName}, ${c.firstName}`;
  return c.displayName;
}

function Field({ label, value, mono, trailing }: { label: string; value: string; mono?: boolean; trailing?: React.ReactNode }) {
  return (
    <div>
      <div className="font-label-sm text-label-sm text-outline uppercase text-[9px]">{label}</div>
      <div className={`border-b border-outline-variant text-body-md py-0.5 truncate flex justify-between items-center ${mono ? "font-mono-data" : ""}`}>
        <span className="truncate">{value}</span>
        {trailing}
      </div>
    </div>
  );
}

export function AddressBook() {
  const { contacts, create, update, remove } = useContacts();
  const [editing, setEditing] = useState<{ draft: ContactDraft | undefined; id: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  const present = useMemo(() => new Set(contacts.map((c) => displayedName(c).charAt(0).toUpperCase())), [contacts]);
  const visible = useMemo(() => {
    let list = filterContacts(contacts, query);
    if (letter) list = list.filter((c) => displayedName(c).charAt(0).toUpperCase() === letter);
    return sortContacts(list, "name");
  }, [contacts, query, letter]);

  async function onSubmit(draft: ContactDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <ContactForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: 12 }} onClick={async () => { await remove(editing.id!); setEditing(null); }}>
            Supprimer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="font-body-md text-on-surface">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-primary pb-1 mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl" aria-hidden>contact_page</span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Address Book</h2>
        </div>
        <span className="font-mono-data text-mono-data text-outline">SEC: ADDRESS_01</span>
      </div>

      {/* Search + add + A-Z */}
      <div className="mb-6 flex gap-2 items-start">
        <div className="flex-grow relative">
          <input
            id="address-search"
            className="w-full bg-transparent border-0 border-b border-outline font-body-md py-1 px-2 italic focus:outline-none"
            placeholder="Rechercher des contacts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher des contacts"
          />
          <span className="absolute right-2 top-1 material-symbols-outlined text-outline" aria-hidden>search</span>
        </div>
        <button
          type="button"
          aria-label="Nouveau contact"
          onClick={() => setEditing({ draft: undefined, id: null })}
          className="w-8 h-8 shrink-0 flex items-center justify-center border-2 border-outline bg-surface-container-low retro-outset active:retro-inset"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>person_add</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-0.5 justify-end mb-4">
        {ALPHABET.map((l) => {
          const has = present.has(l);
          const isActive = letter === l;
          return (
            <button
              key={l}
              type="button"
              disabled={!has}
              onClick={() => setLetter((cur) => (cur === l ? null : l))}
              className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold ${
                isActive ? "bg-primary text-white" : has ? "bg-surface-container text-on-surface-variant hover:bg-surface-container-high" : "bg-surface-container/40 text-outline-variant/50"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* Contact cards */}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-on-surface-variant italic">Aucun contact</p>
      ) : (
        <div className="space-y-6">
          {visible.map((c) => {
            const phone = c.phones[0]?.value;
            const email = c.emails[0]?.value;
            const addr = c.addresses[0];
            return (
              <div key={c.id} className="border border-outline-variant p-3 bg-white/50">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <button type="button" onClick={() => setEditing({ draft: draftFromContact(c), id: c.id })} className="flex items-center gap-3 text-left min-w-0">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="" className="w-12 h-12 object-cover border border-outline-variant shrink-0" />
                    ) : (
                      <div className="w-12 h-12 shrink-0 border border-outline-variant bg-surface-container flex items-center justify-center font-headline-md text-headline-md text-on-surface-variant">
                        {displayedName(c).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-label-sm text-label-sm text-primary uppercase">Nom</div>
                      <div className="font-headline-md text-headline-md leading-tight truncate">{displayedName(c)}</div>
                    </div>
                  </button>
                  <div className="flex gap-2 shrink-0">
                    {phone && (
                      <a href={`tel:${phone}`} aria-label="Appeler" className="w-8 h-8 flex items-center justify-center border border-outline bg-surface-container-low hover:bg-primary/10">
                        <span className="material-symbols-outlined text-sm" aria-hidden>phone</span>
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} aria-label="Envoyer un e-mail" className="w-8 h-8 flex items-center justify-center border border-outline bg-surface-container-low hover:bg-primary/10">
                        <span className="material-symbols-outlined text-sm" aria-hidden>mail</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {c.phones.slice(0, 2).map((p, i) => (
                      <Field key={i} label={p.label || "Téléphone"} value={p.value} mono />
                    ))}
                    {c.phones.length === 0 && c.organization && <Field label="Organisation" value={c.organization} />}
                  </div>
                  <div className="space-y-2">
                    {email && <Field label={c.emails[0]?.label || "E-mail"} value={email} />}
                    {addr && (
                      <Field
                        label={addr.label || "Adresse"}
                        value={[addr.city, addr.country].filter(Boolean).join(", ") || addr.street}
                        trailing={<span className="material-symbols-outlined text-xs" aria-hidden>map</span>}
                      />
                    )}
                    {!email && !addr && c.organization && <Field label="Organisation" value={c.organization} />}
                  </div>
                </div>

                {c.notes && (
                  <div className="mt-3 pt-2 border-t border-dotted border-outline-variant">
                    <div className="font-label-sm text-label-sm text-outline uppercase text-[9px]">Notes</div>
                    <div className="text-body-md italic leading-tight">{c.notes}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
