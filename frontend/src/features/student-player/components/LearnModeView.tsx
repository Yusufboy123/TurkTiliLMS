import type { StudentLessonBlock } from '../types/student-player.types';
import { RichTextContent } from './RichTextContent';
import { VocabularyLearningPanel } from './VocabularyLearningPanel';
import { Button, Card } from '../../../components';

interface LearnModeViewProps {
  blocks: StudentLessonBlock[];
  summary: string | null;
  content: string | null;
  enrollmentId: string;
  lessonId: string;
  canAccess: boolean;
  mediaUrls: Record<string, string>;
  onStartPractice: () => void;
}

export function LearnModeView({
  blocks,
  summary,
  content,
  enrollmentId,
  lessonId,
  canAccess,
  mediaUrls,
  onStartPractice,
}: LearnModeViewProps) {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Overview / Introduction summary */}
      {(summary || content) && (
        <section aria-labelledby="lesson-intro-heading">
          <Card elevation="none" padding="lg" className="border-l-4 border-l-action-primary-bg bg-surface">
            <h2 className="sr-only" id="lesson-intro-heading">Dars haqida</h2>
            {summary && <p className="text-body-lg leading-8 font-medium text-text-primary">{summary}</p>}
            {content && <p className="mt-3 whitespace-pre-wrap text-body-lg leading-8 text-text-secondary">{content}</p>}
          </Card>
        </section>
      )}

      {/* Lesson Content Blocks */}
      {blocks.length > 0 && (
        <section aria-labelledby="lesson-blocks-heading" className="space-y-6">
          <h2 className="sr-only" id="lesson-blocks-heading">Dars nazariyasi va materiallar</h2>
          {blocks.map((block) => {
            const mediaUrl = (block.mediaFileId ? mediaUrls[block.mediaFileId] : undefined) ?? block.sourceUrl ?? block.fileUrl;
            return (
              <article key={block.id} className="rounded-xl border border-border-decorative bg-surface p-5 shadow-subtle sm:p-8">
                {(block.blockType !== 'TEXT' || blocks.length > 1) && block.title ? (
                  <h3 className="mb-4 type-heading-3 text-text-primary">{block.title}</h3>
                ) : null}

                {block.description && (
                  <p className="mb-4 text-body-md text-text-secondary">{block.description}</p>
                )}

                {block.blockType === 'TEXT' && block.textContent && (
                  <RichTextContent text={block.textContent} />
                )}

                {block.blockType === 'VIDEO' && mediaUrl && (
                  <div className="mt-4 overflow-hidden rounded-lg bg-black shadow-md">
                    <video aria-label={block.title ?? 'Video dars'} className="aspect-video w-full" controls preload="metadata" src={mediaUrl} />
                  </div>
                )}

                {block.blockType === 'AUDIO' && mediaUrl && (
                  <div className="mt-4 rounded-lg bg-subtle p-4 border border-border-decorative">
                    <audio aria-label={block.title ?? 'Audio dars'} className="w-full" controls preload="metadata" src={mediaUrl} />
                  </div>
                )}

                {block.blockType === 'IMAGE' && mediaUrl && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-border-decorative">
                    <img alt={block.title ?? 'Dars rasmi'} className="max-h-[32rem] w-full object-contain" src={mediaUrl} />
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Vocabulary list for this lesson */}
      <VocabularyLearningPanel enabled={canAccess} enrollmentId={enrollmentId} lessonId={lessonId} />

      {/* End of LEARN mode CTA -> Move to PRACTICE */}
      <Card elevation="none" padding="lg" className="border border-action-primary-bg/30 bg-action-primary-bg/5 text-center my-10">
        <h3 className="type-heading-3 text-text-primary mb-2">Nazariya va qoidalarni o‘qib bo‘ldingizmi?</h3>
        <p className="text-body-md text-text-secondary mb-6 max-w-md mx-auto">
          Endi o‘rgangan bilimlaringizni interaktiv mashqlarda sinab ko‘ring.
        </p>
        <Button size="lg" width="full" onClick={onStartPractice} className="sm:w-auto px-8">
          Mashqlarni boshlash ▶
        </Button>
      </Card>
    </div>
  );
}
