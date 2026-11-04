"use client";

import { type Editor, useEditorState } from "@tiptap/react";

type ToolbarProps = { editor: Editor; disabled?: boolean };

function Button({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // The pressed state is exposed to assistive tech, not just styled.
      aria-pressed={active}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      // Keep focus in the document so formatting applies to the selection.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-200/70"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />;

export function Toolbar({ editor, disabled = false }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      h1: instance.isActive("heading", { level: 1 }),
      h2: instance.isActive("heading", { level: 2 }),
      h3: instance.isActive("heading", { level: 3 }),
      paragraph: instance.isActive("paragraph"),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      aria-controls="document-body"
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5"
    >
      <Button
        label="Bold"
        shortcut="Cmd+B"
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </Button>
      <Button
        label="Italic"
        shortcut="Cmd+I"
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic font-serif">I</span>
      </Button>
      <Button
        label="Underline"
        shortcut="Cmd+U"
        active={state.underline}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </Button>

      <Divider />

      <Button
        label="Normal text"
        active={state.paragraph}
        disabled={disabled}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        Normal
      </Button>
      <Button
        label="Heading 1"
        active={state.h1}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </Button>
      <Button
        label="Heading 2"
        active={state.h2}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Button>
      <Button
        label="Heading 3"
        active={state.h3}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Button>

      <Divider />

      <Button
        label="Bulleted list"
        active={state.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </Button>
      <Button
        label="Numbered list"
        active={state.orderedList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </Button>
    </div>
  );
}
