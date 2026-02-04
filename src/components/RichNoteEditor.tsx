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
  const toolbarBtnClass = (active = false) =>
    `h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center transition-colors ${
      active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary/70'
    }`;

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#121417] border border-white/10 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.75)]">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5 p-2.5 sm:p-3 border-b border-white/10 bg-[#171a1f]">
        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={toolbarBtnClass(editor.isActive('bold'))}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={toolbarBtnClass(editor.isActive('italic'))}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={toolbarBtnClass(editor.isActive('strike'))}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="h-7 sm:h-8 w-px bg-white/10 mx-0.5" />

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolbarBtnClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="h-7 sm:h-8 w-px bg-white/10 mx-0.5" />

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarBtnClass(editor.isActive('bulletList'))}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarBtnClass(editor.isActive('orderedList'))}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={toolbarBtnClass(editor.isActive('blockquote'))}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="h-7 sm:h-8 w-px bg-white/10 mx-0.5" />

        {/* Code & Links */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={toolbarBtnClass(editor.isActive('codeBlock'))}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>

        <button
          onClick={addLink}
          className={toolbarBtnClass(editor.isActive('link'))}
          title="Add Link"
        >
          <Link2 className="w-4 h-4" />
        </button>

        <button
          onClick={addImage}
          className={toolbarBtnClass()}
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

        <div className="h-7 sm:h-8 w-px bg-white/10 mx-0.5" />

        {/* History */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={`${toolbarBtnClass()} disabled:opacity-40`}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={`${toolbarBtnClass()} disabled:opacity-40`}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-7 sm:h-8 w-px bg-white/10 mx-0.5" />

        {/* Clear & Preview */}
        <button
          onClick={() => editor.chain().focus().clearContent().run()}
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/70 hover:text-destructive transition-colors"
          title="Clear All"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className={toolbarBtnClass(showPreview)}
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>

        <div className="flex-1" />
        
        {/* Character Count */}
        <div className="hidden sm:flex items-center gap-2 px-2 text-xs text-muted-foreground/80">
          <span>{charCount} chars</span>
          <span>•</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className={`apple-note-editor prose prose-invert max-w-none p-4 sm:p-5 text-[16px] leading-[1.6] text-foreground focus:outline-none
          prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground
          prose-em:text-foreground prose-a:text-primary prose-code:text-foreground
          prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary
          min-h-64 sm:min-h-72 bg-[#111317] ${showPreview ? 'hidden' : ''}`}
      />

      {/* Preview Mode */}
      {showPreview && (
        <div className="p-4 sm:p-5 min-h-64 sm:min-h-72 bg-[#111317]">
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
