"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";

interface RichTextMediaOption {
  id: number;
  title: string;
  filename: string;
  url: string;
  alt: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mediaOptions?: RichTextMediaOption[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  mediaOptions = [],
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      Image.configure({
        inline: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: "presslyn-editor",
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.isEmpty ? "" : currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalized = toEditorHtml(value);
    if (normalized !== editor.getHTML()) {
      editor.commands.setContent(normalized, {
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="presslyn-editor-shell">
        <div className="presslyn-editor">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="presslyn-editor-shell">
      <div className="presslyn-editor-toolbar">
        <ToolbarButton
          active={editor.isActive("paragraph")}
          label="Paragraph"
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          label="H2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          label="H3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          active={editor.isActive("bold")}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          label="Bullet List"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          label="Numbered List"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          active={editor.isActive("blockquote")}
          label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          active={editor.isActive("codeBlock")}
          label="Code"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarButton
          active={false}
          disabled={!editor.can().undo()}
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          active={false}
          disabled={!editor.can().redo()}
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {mediaOptions.length > 0 ? (
        <div className="presslyn-editor-media-strip">
          <span className="presslyn-editor-media-label">Insert image</span>
          <div className="presslyn-editor-media-list">
            {mediaOptions.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={preventToolbarFocus}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .setImage({
                      src: item.url,
                      alt: item.alt || item.title || item.filename,
                      title: item.title || item.filename,
                    })
                    .run()
                }
                className="presslyn-editor-media-button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt || item.title || item.filename}
                  className="presslyn-editor-media-thumb"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={preventToolbarFocus}
      onClick={onClick}
      disabled={disabled}
      className={`presslyn-editor-tool ${active ? "is-active" : ""}`}
    >
      {label}
    </button>
  );
}

function preventToolbarFocus(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

function toEditorHtml(value: string) {
  if (!value.trim()) {
    return "<p></p>";
  }

  if (/<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
