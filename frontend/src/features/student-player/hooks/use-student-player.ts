import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return { lesson, blocks };
}

export function useStudentLessonVocabulary(enrollmentId: string, lessonId: string, enabled: boolean) {
  return useQuery({ queryKey: studentPlayerQueryKeys.vocabulary(enrollmentId, lessonId), queryFn: () => studentPlayerApi.getVocabulary(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
}

export function useStudentLessonQuiz(enrollmentId: string, lessonId: string, enabled: boolean) {
  const client = useQueryClient();
  const quiz = useQuery({ queryKey: studentPlayerQueryKeys.quiz(enrollmentId, lessonId), queryFn: () => studentPlayerApi.getQuiz(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
  const latestResult = useQuery({ queryKey: studentPlayerQueryKeys.quizResult(enrollmentId, lessonId), queryFn: () => studentPlayerApi.getLatestQuizResult(enrollmentId, lessonId), enabled: enabled && Boolean(enrollmentId && lessonId) });
  const start = useMutation({ mutationFn: () => studentPlayerApi.startQuiz(enrollmentId, lessonId) });
  const submit = useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Parameters<typeof studentPlayerApi.submitQuiz>[3] }) => studentPlayerApi.submitQuiz(enrollmentId, lessonId, attemptId, answers), onSuccess: (result) => { client.setQueryData(studentPlayerQueryKeys.quizResult(enrollmentId, lessonId), result); } });
  return { quiz, latestResult, start, submit };
}
