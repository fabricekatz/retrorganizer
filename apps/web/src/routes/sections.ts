import type { SectionId } from "@retrorganizer/ui";

export interface Section {
  id: SectionId;
  label: string;
  path: string;
  mvp: boolean;
}

export const SECTIONS: Section[] = [
  { id: "diary", label: "Diary", path: "/diary", mvp: true },
  { id: "todo", label: "To Do", path: "/todo", mvp: true },
  { id: "address", label: "Address", path: "/address", mvp: true },
  { id: "notepad", label: "Notepad", path: "/notepad", mvp: true },
  { id: "planner", label: "Planner", path: "/planner", mvp: false },
  { id: "anniversary", label: "Anniversary", path: "/anniversary", mvp: false },
  { id: "web", label: "Web", path: "/web", mvp: false },
  { id: "calls", label: "Calls", path: "/calls", mvp: false },
];
