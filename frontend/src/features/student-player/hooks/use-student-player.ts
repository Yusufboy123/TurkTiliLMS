import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentPlayerApi } from '../api/student-player.api';
import { studentPlayerQueryKeys } from './student-player-query-keys';

export function useStudentLessonContent(courseSlug: string, lessonSlug: string, enabled: boolean) {
  const lesson = useQuery({
    queryKey: studentPlayerQueryKeys.lesson(courseSlug, lessonSlug),
    queryFn: () => studentPlayerApi.getLesson(courseSlug, lessonSlug),
    enabled: enabled && Boolean(courseSlug && lessonSlug),
  });
  const blocks = useQuery({
    queryKey: studentPlayerQueryKeys.blocks(courseSlug, lessonSlug),
    queryFn: () => studentPlayerApi.getBlocks(courseSlug, lessonSlug),
    enabled: enabled && Boolean(courseSlug && lessonSlug),
  });
  const mediaBlocks = (blocks.data ?? []).filter((block) => block.mediaFileId);
  const mediaQueries = useQueries({
    queries: mediaBlocks.map((block) => ({
      queryKey: ['student-media-url', block.mediaFileId],
      queryFn: () => studentPlayerApi.getMediaUrl(block.mediaFileId as string),
      enabled: enabled,
      staleTime: 240_000,
    })),
  });
  const mediaUrls = Object.fromEntries(
    mediaBlocks.map((block, index) => [block.mediaFileId, mediaQueries[index]?.data?.url]).filter(([id, url]) => Boolean(id && url)),
  ) as Record<string, string>;
  return { lesson, blocks, mediaUrls };
}

export function useStudentLessonVocabulary(enrollmentId: string, lessonId: string, enabled: boolean) {
  return useQuery({ queryKey: [...studentPlayerQueryKeys.vocabulary(enrollmentId, lessonId), 'learning'], queryFn: () => studentPlayerApi.getVocabularyLearning(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
}

export function useVocabularyLearningMutations(enrollmentId: string, lessonId: string, enabled = true) {
  const client = useQueryClient();
  const key = [...studentPlayerQueryKeys.vocabulary(enrollmentId, lessonId), 'learning'];
  const invalidateProgress = () => void client.invalidateQueries({ queryKey: ['progress'] });
  const status = useMutation({ mutationFn: ({ vocabularyId, value }: { vocabularyId: string; value: 'KNOWN' | 'NEEDS_REVIEW' }) => studentPlayerApi.updateVocabularyStatus(enrollmentId, lessonId, vocabularyId, value), onSuccess: () => void client.invalidateQueries({ queryKey: key }) });
  const start = useMutation({ mutationFn: () => studentPlayerApi.startVocabularyTest(enrollmentId, lessonId) });
  const submit = useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Array<{ vocabularyId: string; submittedAnswer: string }> }) => studentPlayerApi.submitVocabularyTest(enrollmentId, lessonId, attemptId, answers), onSuccess: invalidateProgress });
  const latest = useQuery({ queryKey: [...key, 'result'], queryFn: () => studentPlayerApi.getLatestVocabularyResult(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
  return { status, start, submit, latest };
}

export function useStudentLessonQuiz(enrollmentId: string, lessonId: string, enabled: boolean) {
  const client = useQueryClient();
  const quiz = useQuery({ queryKey: studentPlayerQueryKeys.quiz(enrollmentId, lessonId), queryFn: () => studentPlayerApi.getQuiz(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
  const latestResult = useQuery({ queryKey: studentPlayerQueryKeys.quizResult(enrollmentId, lessonId), queryFn: () => studentPlayerApi.getLatestQuizResult(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
  const start = useMutation({ mutationFn: () => studentPlayerApi.startQuiz(enrollmentId, lessonId) });
  const submit = useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Parameters<typeof studentPlayerApi.submitQuiz>[3] }) => studentPlayerApi.submitQuiz(enrollmentId, lessonId, attemptId, answers), onSuccess: (result) => { client.setQueryData(studentPlayerQueryKeys.quizResult(enrollmentId, lessonId), result); void client.invalidateQueries({ queryKey: ['progress'] }); } });
  return { quiz, latestResult, start, submit };
}
