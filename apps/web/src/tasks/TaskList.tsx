import { tokens } from "@retrorganizer/ui";
import { categoryById, type Task, type TaskStatus, type Category } from "@retrorganizer/core";
import { CategoryTagBadges } from "../categories/CategoryTagBadges";

export type StatusFilter = TaskStatus | "all";
export type TaskSortKey = "priority" | "dueDate" | "title";

export interface TaskListProps {
  tasks: Task[];
  categories: Category[];
  onSelect(t: Task): void;
  onNew(): void;
  onToggleComplete(t: Task): void;
  statusFilter: StatusFilter;
  onStatusFilterChange(s: StatusFilter): void;
  search: string;
  onSearchChange(s: string): void;
  sortKey: TaskSortKey;
  onSortKeyChange(k: TaskSortKey): void;
}

const PRIORITY_LABEL: Record<Task["priority"], string> = { low: "Basse", normal: "Normale", high: "Haute" };

function dueLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function TaskList(props: TaskListProps) {
  const { tasks, categories, onSelect, onNew, onToggleComplete, statusFilter, onStatusFilterChange, search, onSearchChange, sortKey, onSortKeyChange } = props;
  return (
    <div style={{ padding: tokens.space.sm, font: `13px ${tokens.font.body}` }}>
      <div style={{ display: "flex", gap: tokens.space.sm, marginBottom: tokens.space.sm, flexWrap: "wrap" }}>
        <input aria-label="Rechercher" placeholder="Rechercher" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        <select aria-label="Filtrer par statut" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}>
          <option value="all">Tous</option>
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="done">Terminé</option>
        </select>
        <select aria-label="Trier par" value={sortKey} onChange={(e) => onSortKeyChange(e.target.value as TaskSortKey)}>
          <option value="priority">Priorité</option>
          <option value="dueDate">Échéance</option>
          <option value="title">Titre</option>
        </select>
        <button type="button" onClick={onNew}>+ Nouvelle tâche</button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {tasks.map((t) => {
          const doneCount = t.subtasks.filter((s) => s.done).length;
          return (
            <li key={t.id} style={{ display: "flex", alignItems: "center", gap: tokens.space.sm,
              borderBottom: `1px solid ${tokens.color.line}`, padding: tokens.space.xs }}>
              <input type="checkbox" aria-label={`Terminer ${t.title}`} checked={t.status === "done"}
                onChange={() => onToggleComplete(t)} />
              <button type="button" onClick={() => onSelect(t)}
                style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer",
                  color: tokens.color.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                <span style={{ display: "block" }}>{t.title}</span>
                <CategoryTagBadges category={categoryById(categories, t.categoryId)} tags={t.tags} />
              </button>
              <span style={{ color: tokens.color.muted, fontSize: 11 }}>{PRIORITY_LABEL[t.priority]}</span>
              {t.dueDate !== null && <span style={{ color: tokens.color.muted, fontSize: 11 }}>{dueLabel(t.dueDate)}</span>}
              {t.subtasks.length > 0 && <span style={{ color: tokens.color.muted, fontSize: 11 }}>{doneCount}/{t.subtasks.length}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
