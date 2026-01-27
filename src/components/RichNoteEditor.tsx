import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, Link2, Image as ImageIcon, Code, Undo2, Redo2, Heading2, ListOrdered, Quote, Strikethrough, Trash2, Eye } from 'lucide-react';
import { useState, useRef } from 'react';

interface RichNoteEditorProps {
  content: any;
  onChange: (content: any) => void;
  placeholder?: string;
}

export const RichNoteEditor = ({ content, onChange, placeholder = "Write your trade journal entry..." }: RichNoteEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  
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
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        editor.chain().focus().setImage({ src: url }).run();
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const wordCount = editor.storage.characterCount?.words?.() || 0;
  const charCount = editor.storage.characterCount?.characters?.() || 0;

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-3 border-b border-border bg-secondary/20">
        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('strike') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="border-r border-border" />

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="border-r border-border" />

        {/* Lists */}
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
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('orderedList') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('blockquote') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="border-r border-border" />

        {/* Code & Links */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            editor.isActive('codeBlock') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>

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
          title="Add Image (File)"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <div className="border-r border-border" />

        {/* History */}
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

        <div className="border-r border-border" />

        {/* Clear & Preview */}
        <button
          onClick={() => editor.chain().focus().clearContent().run()}
          className="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
          title="Clear All"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`p-2 rounded hover:bg-secondary transition-colors ${
            showPreview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>

        <div className="flex-1" />
        
        {/* Character Count */}
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span>{charCount} chars</span>
          <span>•</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className={`prose prose-invert max-w-none p-4 text-foreground focus:outline-none
          prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground
          prose-em:text-foreground prose-a:text-primary prose-code:text-foreground
          prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary
          min-h-64 ${showPreview ? 'hidden' : ''}`}
      />

      {/* Preview Mode */}
      {showPreview && (
        <div className="p-4 min-h-64 bg-background">
          <div className="prose prose-invert max-w-none text-foreground
            prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground
            prose-em:text-foreground prose-a:text-primary prose-code:text-foreground
            prose-li:text-foreground prose-blockquote:text-muted-foreground">
            {content && editor.getHTML() ? (
              <div dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
            ) : (
              <p className="text-muted-foreground italic">Nothing to preview yet...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
