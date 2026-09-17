import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, FormField, Input, Select, Textarea } from '../../../components';
import { useTeacherLessonBlocks, useUpsertTeacherPracticeHolder } from '../hooks/use-teacher-lessons';
import type { InteractivePracticeItem } from '../types/teacher-lessons.types';

export function TeacherPracticePanel({ courseId, lessonId, canUpdate }: { courseId: string; lessonId: string; canUpdate: boolean }) {
  const blocksQuery = useTeacherLessonBlocks(courseId, lessonId);
  const upsertPractice = useUpsertTeacherPracticeHolder(courseId, lessonId);

  const practiceBlock = blocksQuery.data?.items.find((b) => (b as { isPracticeHolder?: boolean }).isPracticeHolder);
  const items: InteractivePracticeItem[] = (practiceBlock?.interactivePractice as InteractivePracticeItem[]) ?? [];

  const [editingIndex, setEditingIndex] = useState<number | 'new' | null>(null);

  const handleSaveItem = (item: InteractivePracticeItem, index: number | 'new') => {
    const nextItems = [...items];
    if (index === 'new') {
      nextItems.push({ ...item, id: crypto.randomUUID(), stage: nextItems.length + 1 });
    } else {
      nextItems[index] = item;
    }
    upsertPractice.mutate(nextItems, { onSuccess: () => setEditingIndex(null) });
  };

  const handleDeleteItem = (index: number) => {
    if (!window.confirm("Rostdan ham o'chirasizmi?")) return;
    const nextItems = items.filter((_, i) => i !== index);
    upsertPractice.mutate(nextItems);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-heading-3">Amaliy mashqlar</h2>
          <p className="mt-2 text-body-sm text-text-secondary">Talabalar uchun interaktiv mashqlar yarating.</p>
        </div>
        {canUpdate && (
          <Button intent="secondary" onClick={() => setEditingIndex('new')}>Mashq qo'shish</Button>
        )}
      </div>

      {blocksQuery.isPending && <p className="mt-5">Yuklanmoqda...</p>}

      {editingIndex === 'new' && (
        <div className="mt-5">
          <PracticeItemForm 
            onDone={() => setEditingIndex(null)}
            onSave={(item) => handleSaveItem(item, 'new')}
            pending={upsertPractice.isPending}
          />
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {items.map((item, index) => (
          editingIndex === index ? (
            <PracticeItemForm 
              key={item.id}
              item={item}
              onDone={() => setEditingIndex(null)}
              onSave={(savedItem) => handleSaveItem(savedItem, index)}
              pending={upsertPractice.isPending}
            />
          ) : (
            <div className="rounded-lg border border-border-decorative p-4" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge intent="info">{item.type}</Badge>
                  <h3 className="type-heading-4 mt-2">{index + 1}. {item.prompt}</h3>
                  <p className="mt-1 text-body-sm text-text-secondary">Javob: {item.answer}</p>
                </div>
                {canUpdate && (
                  <div className="flex flex-wrap gap-2">
                    <Button intent="secondary" onClick={() => setEditingIndex(index)} size="sm">Tahrirlash</Button>
                    <Button disabled={upsertPractice.isPending} intent="secondary" onClick={() => handleDeleteItem(index)} size="sm">O'chirish</Button>
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </Card>
  );
}

function PracticeItemForm({ item, onDone, onSave, pending }: { item?: InteractivePracticeItem; onDone: () => void; onSave: (item: InteractivePracticeItem) => void; pending: boolean; }) {
  const [type, setType] = useState<string>(item?.type ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(item?.prompt ?? '');
  const [answer, setAnswer] = useState(item?.answer ?? '');
  const [explanation, setExplanation] = useState(item?.explanation ?? '');
  const [optionsStr, setOptionsStr] = useState(item?.options?.join('\n') ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const options = optionsStr.split('\n').map((s: string) => s.trim()).filter(Boolean);
    const result: InteractivePracticeItem = { id: item?.id ?? crypto.randomUUID(), type, prompt, answer, explanation: explanation || undefined, stage: item?.stage ?? 1 };
    if (['MULTIPLE_CHOICE', 'CLASSIFY'].includes(type) && options.length > 0) {
      result.options = options;
    }
    if (type === 'TRUE_FALSE') {
      result.options = ['To‘g‘ri', 'Noto‘g‘ri'];
    }
    onSave(item ? { ...item, ...result } : result);
  };

  return (
    <form className="grid gap-4 rounded-lg border border-border-decorative bg-subtle p-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mashq turi" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</option>
            <option value="TRUE_FALSE">TRUE_FALSE</option>
            <option value="MISSING_WORD">MISSING_WORD</option>
            <option value="CLASSIFY">CLASSIFY</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Savol matni (prompt)" required>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        <span className="text-body-sm text-text-secondary mt-1">MISSING_WORD uchun bo'sh joyni qoldiring, masalan: "Men ___ boraman."</span>
      </FormField>

      {['MULTIPLE_CHOICE', 'CLASSIFY'].includes(type) && (
        <FormField label="Variantlar (har bir qator bitta variant)">
          <Textarea value={optionsStr} onChange={(e) => setOptionsStr(e.target.value)} />
        </FormField>
      )}

      <FormField label="To'g'ri javob" required>
        {type === 'TRUE_FALSE' ? (
          <Select value={answer} onChange={(e) => setAnswer(e.target.value)}>
            <option value="">Tanlang...</option>
            <option value="To‘g‘ri">To‘g‘ri</option>
            <option value="Noto‘g‘ri">Noto‘g‘ri</option>
          </Select>
        ) : (
          <Input value={answer} onChange={(e) => setAnswer(e.target.value)} required />
        )}
      </FormField>

      <FormField label="Izoh (ixtiyoriy)">
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </FormField>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !prompt || !answer} loading={pending} type="submit">Saqlash</Button>
        <Button intent="secondary" onClick={onDone} type="button">Bekor qilish</Button>
      </div>
    </form>
  );
}
