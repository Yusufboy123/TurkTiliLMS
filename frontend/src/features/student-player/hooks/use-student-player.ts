import { useQuery } from '@tanstack/react-query';
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
