import { useMemo, useState } from "react";
import { tokens } from "@retrorganizer/ui";
import {
  filterTasks, sortTasks, nextOccurrenceAfter, draftFromTask, emptyTaskDraft,
  type Task, type TaskDraft,
} from "@retrorganizer/core";
import { useTasks } from "./useTasks";
import { useCategories } from "../categories/useCategories";
import { useFocusParam } from "../search/useFocusParam";
import { TaskList, type StatusFilter, type TaskSortKey } from "./TaskList";
import { TaskForm } from "./TaskForm";

export function TasksModule() {
  const { tasks, loading, error, create, update, remove } = useTasks();
  const { categories } = useCategories();
  const [editing, setEditing] = useState<{ draft: TaskDraft; id: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<TaskSortKey>("priority");

  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, { status: statusFilter, search }), sortKey),
    [tasks, statusFilter, search, sortKey],
  );

  useFocusParam(tasks, loading, (t) => setEditing({ draft: draftFromTask(t), id: t.id }));

  async function onSubmit(draft: TaskDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  async function onToggleComplete(t: Task) {
    if (t.recurrence && t.dueDate !== null && t.status !== "done") {
      const next = nextOccurrenceAfter(t.recurrence, t.dueDate);
      if (next !== null) {
        await update(t.id, { dueDate: next, status: "todo", completedAt: null });
        return;
      }
      // recurrence exhausted -> fall through to mark done
    }
    if (t.status === "done") await update(t.id, { status: "todo", completedAt: null });
    else await update(t.id, { status: "done", completedAt: Date.now() });
  }

  if (loading) return <div style={{ padding: tokens.space.lg }}>Chargement…</div>;

  if (editing) {
    return (
      <div>
        <TaskForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {editing.id && (
          <button type="button" style={{ margin: tokens.space.md }}
            onClick={async () => { await remove(editing.id!); setEditing(null); }}>Supprimer</button>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && <p role="alert" style={{ color: "#a8431f", padding: tokens.space.sm }}>{error}</p>}
      <TaskList
        tasks={visible}
        categories={categories}
        onSelect={(t) => setEditing({ draft: draftFromTask(t), id: t.id })}
        onNew={() => setEditing({ draft: emptyTaskDraft(), id: null })}
        onToggleComplete={onToggleComplete}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        search={search} onSearchChange={setSearch}
        sortKey={sortKey} onSortKeyChange={setSortKey}
      />
    </div>
  );
}
