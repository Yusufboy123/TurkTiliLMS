import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { levelFinalExamApi } from '../api/level-final-exam.api';

export function useLevelFinalExam(enrollmentId: string) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['level-final-exam', enrollmentId],
    queryFn: () => levelFinalExamApi.status(enrollmentId),
    enabled: Boolean(enrollmentId),
  });
  const start = useMutation({ mutationFn: () => levelFinalExamApi.start(enrollmentId) });
  const submit = useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Array<{ questionId: string; submittedAnswer: string }> }) => levelFinalExamApi.submit(enrollmentId, attemptId, answers),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['level-final-exam', enrollmentId] }); },
  });
  return { status, start, submit };
}
