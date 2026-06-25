import type { Contact } from "./contact";

export function filterContacts(cs: Contact[], q: string): Contact[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return cs;
  return cs.filter((c) => {
    const hay = [
      c.displayName, c.firstName, c.lastName, c.organization ?? "",
      ...c.emails.map((e) => e.value),
      ...c.phones.map((p) => p.value),
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

export function sortContacts(cs: Contact[], key: "name" | "organization"): Contact[] {
  const copy = [...cs];
  copy.sort((a, b) => {
    if (key === "organization") {
      const byOrg = (a.organization ?? "").localeCompare(b.organization ?? "", undefined, { sensitivity: "base" });
      if (byOrg !== 0) return byOrg;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
  return copy;
}
