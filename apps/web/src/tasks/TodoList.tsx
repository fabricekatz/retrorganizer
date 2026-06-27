import { useMemo, useState } from "react";
import {
  filterTasks, sortTasks, nextOccurrenceAfter, draftFromTask, emptyTaskDraft, sameDay,
  type Task, type TaskDraft, type TaskStatus,
} from "@retrorganizer/core";
import { useTasks } from "./useTasks";
import { TaskForm } from "./TaskForm";

type StatusFilter = TaskStatus | "all";
type SortKey = "priority" | "dueDate" | "title";

const STATUS_CYCLE: StatusFilter[] = ["all", "todo", "done"];
const STATUS_LABEL: Record<StatusFilter, string> = { all: "ALL", todo: "À FAIRE", in_progress: "EN COURS", done: "TERMINÉ" };
const SORT_CYCLE: SortKey[] = ["priority", "dueDate", "title"];
const SORT_LABEL: Record<SortKey, string> = { priority: "PRIORITÉ", dueDate: "ÉCHÉANCE", title: "TITRE" };

const PRIO: Record<Task["priority"], { label: string; cls: string; bold: boolean }> = {
  high: { label: "PRIORITÉ 1", cls: "bg-red-100 text-red-800 border-red-200", bold: true },
  normal: { label: "PRIORITÉ 2", cls: "bg-yellow-100 text-yellow-800 border-yellow-200", bold: false },
  low: { label: "PRIORITÉ 3", cls: "bg-green-100 text-green-800 border-green-200", bold: false },
};
const MONTHS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUI", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];

function dueLabel(ms: number): string {
  if (sameDay(ms, Date.now())) return "AUJOURD'HUI";
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function TodoList() {
  const { tasks, create, update, remove } = useTasks();
  const [editing, setEditing] = useState<{ draft: TaskDraft; id: string | null } | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [quick, setQuick] = useState("");

  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, { status, search: "" }), sort),
    [tasks, status, sort],
  );
  const dueTodayCount = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate <= Date.now() + 86400000 && t.dueDate >= Date.now() - 30 * 86400000).length,
    [tasks],
  );

  async function toggle(t: Task) {
    if (t.recurrence && t.dueDate !== null && t.status !== "done") {
      const next = nextOccurrenceAfter(t.recurrence, t.dueDate);
      if (next !== null) {
        await update(t.id, { dueDate: next, status: "todo", completedAt: null });
        return;
      }
    }
    if (t.status === "done") await update(t.id, { status: "todo", completedAt: null });
    else await update(t.id, { status: "done", completedAt: Date.now() });
  }

  async function onSubmit(draft: TaskDraft) {
    if (editing?.id) await update(editing.id, draft);
    else await create(draft);
    setEditing(null);
  }

  async function quickAdd() {
    const raw = quick.trim();
    if (raw === "") return;
    let priority: Task["priority"] = "normal";
    let title = raw;
    const m = raw.match(/\[\s*p?([123])\s*\]\s*$/i);
    if (m) {
      priority = m[1] === "1" ? "high" : m[1] === "3" ? "low" : "normal";
      title = raw.replace(/\[\s*p?[123]\s*\]\s*$/i, "").trim();
    }
    if (title === "") return;
    await create({ ...emptyTaskDraft(), title, priority });
    setQuick("");
  }

  if (editing) {
    return (
      <div className="legacy-content">
        <TaskForm initial={editing.draft} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
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
      {/* Filter / sort toolbar */}
      <div className="shrink-0 flex items-center gap-2 mb-4 p-2 bg-surface-container border border-outline-variant shadow-sm text-on-surface-variant font-label-sm text-label-sm">
        <button type="button" onClick={() => setStatus((s) => STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length]!)} className="flex items-center gap-1 uppercase">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>filter_list</span>
          FILTRE&nbsp;: {STATUS_LABEL[status]}
        </button>
        <div className="h-4 w-px bg-outline-variant mx-1" />
        <button type="button" onClick={() => setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]!)} className="flex items-center gap-1 uppercase">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>sort</span>
          TRI&nbsp;: {SORT_LABEL[sort]}
        </button>
        <div className="flex-1" />
        <span className="material-symbols-outlined text-[18px]" aria-hidden>view_list</span>
      </div>

      {/* Task list */}
      <div className="flex-1 border-t border-outline-variant">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-on-surface-variant font-body-md italic">Aucune tâche</p>
        ) : (
          visible.map((t) => {
            const done = t.status === "done";
            const prio = PRIO[t.priority];
            return (
              <div key={t.id} className="flex items-center h-12 border-b border-outline-variant hover:bg-primary/5 group px-2">
                <input
                  type="checkbox"
                  className="custom-checkbox mr-3"
                  aria-label={`Terminer ${t.title}`}
                  checked={done}
                  onChange={() => void toggle(t)}
                />
                <button type="button" onClick={() => setEditing({ draft: draftFromTask(t), id: t.id })} className={`flex-1 min-w-0 text-left ${done ? "opacity-50 line-through" : ""}`}>
                  <div className={`text-body-md truncate ${prio.bold && !done ? "font-bold" : ""}`}>{t.title}</div>
                  <div className="font-mono-data text-mono-data text-on-surface-variant flex items-center gap-2">
                    {done ? (
                      <span>{t.completedAt ? `TERMINÉ ${dueLabel(t.completedAt)}` : "TERMINÉ"}</span>
                    ) : (
                      <>
                        <span className={`px-1 border ${prio.cls}`}>{prio.label}</span>
                        {t.dueDate !== null && <span>ÉCH.&nbsp;: {dueLabel(t.dueDate)}</span>}
                      </>
                    )}
                  </div>
                </button>
                <span className="material-symbols-outlined text-outline-variant group-hover:text-primary" aria-hidden>drag_handle</span>
              </div>
            );
          })
        )}

        {dueTodayCount > 0 && (
          <div className="mt-8 mb-4 p-4 bg-tertiary-fixed shadow-md border-l-4 border-tertiary-container rotate-1 max-w-[220px] ml-auto">
            <p className="font-headline-md text-tertiary text-[16px] leading-tight mb-2 italic">Rappel !</p>
            <p className="text-body-md text-on-tertiary-fixed-variant leading-tight">
              {dueTodayCount} tâche{dueTodayCount > 1 ? "s" : ""} à faire d'ici aujourd'hui.
            </p>
          </div>
        )}
      </div>

      {/* Quick entry */}
      <div className="shrink-0 mt-3 flex gap-2 items-center">
        <input
          className="flex-1 bg-surface-container-low border-2 border-outline-variant p-2 text-body-md retro-inset focus:outline-none placeholder:italic"
          placeholder="Saisie rapide : nom de la tâche [1-3]…"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void quickAdd(); }}
          aria-label="Saisie rapide d'une tâche"
        />
        <button type="button" aria-label="Ajouter la tâche" onClick={() => void quickAdd()} className="bg-primary text-on-primary p-2 border-2 border-outline retro-outset active:retro-inset">
          <span className="material-symbols-outlined" aria-hidden>add</span>
        </button>
      </div>
    </div>
  );
}
