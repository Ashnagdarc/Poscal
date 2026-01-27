import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, Link2, Image as ImageIcon, Code, Undo2, Redo2 } from 'lucide-react';

interface RichNoteEditorProps {
  content: any;
  onChange: (content: any) => void;
  placeholder?: string;
}

export const RichNoteEditor = ({ content, onChange, placeholder = "Write your trade journal entry..." }: RichNoteEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-3 border-b border-border bg-secondary/20">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('codeBlock') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="border-r border-border" />

        <button
          onClick={addLink}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('link') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Add Link"
        >
          <Link2 className="w-4 h-4" />
        </button>

        <button
          onClick={addImage}
          className="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground"
          title="Add Image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="border-r border-border" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="prose prose-invert max-w-none p-4 text-foreground focus:outline-none
          prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground
          prose-em:text-foreground prose-a:text-primary prose-code:text-foreground
          prose-li:text-foreground prose-blockquote:text-muted-foreground
          min-h-64"
      />
    </div>
  );
};
