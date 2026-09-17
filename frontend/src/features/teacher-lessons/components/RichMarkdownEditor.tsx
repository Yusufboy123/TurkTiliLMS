import { useRef, useState } from 'react';
import { Button, Textarea } from '../../../components';
import { RichTextContent } from '../../student-player/components/RichTextContent';

export interface RichMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function RichMarkdownEditor({ value, onChange, required }: RichMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);

    // Set cursor position back after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Find start of line
    let lineStart = start;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    const newText = value.substring(0, lineStart) + prefix + value.substring(lineStart);
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const insertTable = () => {
    const table = '\n| Ustun 1 | Ustun 2 |\n|---|---|\n| Ma\'lumot | Ma\'lumot |\n';
    insertText(table);
  };

  const insertDivider = () => {
    insertText('\n\n---\n\n');
  };

  const insertLink = () => {
    insertText('[', '](https://)', 'havola matni');
  };

  const insertQuote = () => {
    insertLinePrefix('> ');
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-decorative bg-subtle p-2">
      <div className="flex flex-wrap items-center gap-1 border-b border-border-decorative pb-2">
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('## ')} title="Sarlavha 2">H2</Button>
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('### ')} title="Sarlavha 3">H3</Button>
        <div className="w-px h-4 bg-border-decorative mx-1" />
        <Button intent="secondary" size="sm" type="button" onClick={() => insertText('**', '**', 'Qalin matn')} title="Qalin"><b>B</b></Button>
        <Button intent="secondary" size="sm" type="button" onClick={() => insertText('*', '*', 'Og\'ma matn')} title="Og'ma"><i>I</i></Button>
        <Button intent="secondary" size="sm" type="button" onClick={() => insertText('`', '`', 'kod')} title="Kod">Kod</Button>
        <div className="w-px h-4 bg-border-decorative mx-1" />
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('- ')} title="Ro'yxat">•</Button>
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('1. ')} title="Raqamli ro'yxat">1.</Button>
        <Button intent="secondary" size="sm" type="button" onClick={insertQuote} title="Iqtibos">Quote</Button>
        <div className="w-px h-4 bg-border-decorative mx-1" />
        <Button intent="secondary" size="sm" type="button" onClick={insertTable} title="Jadval">Jadval</Button>
        <Button intent="secondary" size="sm" type="button" onClick={insertDivider} title="Chiziq">---</Button>
        <Button intent="secondary" size="sm" type="button" onClick={insertLink} title="Havola">Link</Button>
        <div className="w-px h-4 bg-border-decorative mx-1" />
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('Muhim: ')} title="Muhim eslatma">Muhim</Button>
        <Button intent="secondary" size="sm" type="button" onClick={() => insertLinePrefix('Eslab qoling: ')} title="Eslab qoling">Eslab qoling</Button>
        
        <div className="flex-1 min-w-[20px]" />
        
        <Button 
          intent={showPreview ? 'primary' : 'secondary'} 
          size="sm" 
          type="button" 
          onClick={() => setShowPreview(!showPreview)}
          className="ml-auto"
        >
          {showPreview ? 'Tahrirlashga qaytish' : 'Preview ko‘rish'}
        </Button>
      </div>

      {showPreview ? (
        <div className="min-h-[250px] rounded bg-surface p-4 border border-border-decorative">
          <RichTextContent text={value || '*Matn kiritilmagan*'} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="min-h-[250px] resize-y"
          placeholder="Matnni shu yerga kiriting. Belgilash orqali tepadagi tugmalardan foydalanishingiz mumkin..."
        />
      )}
    </div>
  );
}
