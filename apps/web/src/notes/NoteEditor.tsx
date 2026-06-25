import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { tokens } from "@retrorganizer/ui";

export interface NoteEditorProps {
  value: unknown;
  onChange(json: unknown): void;
}

export function NoteEditor({ value, onChange }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (value as object) ?? { type: "doc", content: [] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  function btn(label: string, active: boolean, action: () => void) {
    return (
      <button type="button" aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={action}
        style={{ fontWeight: active ? "bold" : "normal", marginRight: tokens.space.xs }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${tokens.color.line}`, background: tokens.color.surface }}>
      <div style={{ display: "flex", flexWrap: "wrap", padding: tokens.space.xs, borderBottom: `1px solid ${tokens.color.line}`, font: `12px ${tokens.font.body}` }}>
        {btn("Gras", !!editor?.isActive("bold"), () => editor?.chain().focus().toggleBold().run())}
        {btn("Italique", !!editor?.isActive("italic"), () => editor?.chain().focus().toggleItalic().run())}
        {btn("Liste à puces", !!editor?.isActive("bulletList"), () => editor?.chain().focus().toggleBulletList().run())}
        {btn("Liste numérotée", !!editor?.isActive("orderedList"), () => editor?.chain().focus().toggleOrderedList().run())}
        {btn("Titre", !!editor?.isActive("heading", { level: 2 }), () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      </div>
      <div style={{ padding: tokens.space.sm }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
