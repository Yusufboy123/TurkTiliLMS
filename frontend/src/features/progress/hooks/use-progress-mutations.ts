import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import { createIdempotencyKey, progressApi, toProgressClientError } from '../api/progress.api';
import type {
  ActivityMutationResult,
  CourseProgress,
  ProgressMutationResult,
} from '../types/progress.types';
import { progressQueryKeys } from './progress-query-keys';

type CompletionAction = 'completeBlock' | 'reopenBlock' | 'completeLesson' | 'reopenLesson';

interface CompletionVariables {
  action: CompletionAction;
  enrollmentId: string;
  resourceId: string;
  curriculumVersion: number;
  expectedCompletionVersion: number;
  idempotencyKey?: string;
}

interface VisitVariables {
  enrollmentId: string;
  lessonId: string;
  curriculumVersion: number;
  idempotencyKey?: string;
}

const completionFeedback: Record<CompletionAction, string> = {
  completeBlock: progressMessages.feedback.blockCompleted,
  reopenBlock: progressMessages.feedback.blockReopened,
  completeLesson: progressMessages.feedback.lessonCompleted,
  reopenLesson: progressMessages.feedback.lessonReopened,
};

export function mergeProgressMutation(
  current: CourseProgress | undefined,
  result: ProgressMutationResult,
): CourseProgress | undefined {
  if (!current) return current;

  return {
    ...current,
    ...result.course,
    curriculumVersion: result.curriculumVersion,
    completionVersion: result.completionVersion,
    activityVersion: result.activityVersion,
    resumeTarget: result.resumeTarget,
    sections: current.sections.map((section) =>
      section.id === result.affectedLesson.sectionId
        ? {
            ...section,
            lessons: section.lessons.map((lesson) =>
              lesson.id === result.affectedLesson.id ? result.affectedLesson : lesson,
            ),
          }
        : section,
    ),
  };
}

function completionRequest(variables: CompletionVariables) {
  const input = {
    curriculumVersion: variables.curriculumVersion,
    expectedCompletionVersion: variables.expectedCompletionVersion,
  };
  const key = variables.idempotencyKey ?? createIdempotencyKey();

  switch (variables.action) {
    case 'completeBlock':
      return progressApi.completeBlock(variables.enrollmentId, variables.resourceId, input, key);
    case 'reopenBlock':
      return progressApi.reopenBlock(variables.enrollmentId, variables.resourceId, input, key);
    case 'completeLesson':
      return progressApi.completeLesson(variables.enrollmentId, variables.resourceId, input, key);
    case 'reopenLesson':
      return progressApi.reopenLesson(variables.enrollmentId, variables.resourceId, input, key);
  }
}

export function useProgressMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const refreshEnrollment = async (enrollmentId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: progressQueryKeys.enrollmentRoot(enrollmentId) }),
      queryClient.invalidateQueries({ queryKey: progressQueryKeys.summaryRoot() }),
      queryClient.invalidateQueries({ queryKey: progressQueryKeys.completedRoot() }),
    ]);
  };

  const completionMutation = useMutation({
    mutationFn: completionRequest,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<CourseProgress>(
        progressQueryKeys.enrollment(variables.enrollmentId),
        (current) => mergeProgressMutation(current, result),
      );
      queryClient.setQueryData(
        progressQueryKeys.resume(variables.enrollmentId),
        result.resumeTarget,
      );
      toast.show({
        intent: result.changed ? 'success' : 'info',
        message: result.changed
          ? completionFeedback[variables.action]
          : progressMessages.feedback.unchanged,
      });
      void refreshEnrollment(variables.enrollmentId);
    },
    onError: (error, variables) => {
      const clientError = toProgressClientError(error);
      toast.show({ intent: 'danger', message: clientError.message });
      if (
        clientError.code === 'CURRICULUM_VERSION_CONFLICT' ||
        clientError.code === 'COMPLETION_VERSION_CONFLICT'
      ) {
        void refreshEnrollment(variables.enrollmentId);
      }
    },
  });

  const visitMutation = useMutation({
    mutationFn: (variables: VisitVariables) =>
      progressApi.recordLastVisitedLesson(
        variables.enrollmentId,
        {
          lessonId: variables.lessonId,
          curriculumVersion: variables.curriculumVersion,
        },
        variables.idempotencyKey ?? createIdempotencyKey(),
      ),
    onSuccess: (result: ActivityMutationResult, variables) => {
      queryClient.setQueryData(
        progressQueryKeys.resume(variables.enrollmentId),
        result.resumeTarget,
      );
      queryClient.setQueryData<CourseProgress>(
        progressQueryKeys.enrollment(variables.enrollmentId),
        (current) =>
          current
            ? {
                ...current,
                activityVersion: result.activityVersion,
                completionVersion: result.completionVersion,
                curriculumVersion: result.curriculumVersion,
                resumeTarget: result.resumeTarget,
              }
            : current,
      );
      toast.show({
        intent: result.changed ? 'success' : 'info',
        message: result.changed
          ? progressMessages.feedback.visitRecorded
          : progressMessages.feedback.unchanged,
      });
      void refreshEnrollment(variables.enrollmentId);
    },
    onError: (error, variables) => {
      const clientError = toProgressClientError(error);
      toast.show({ intent: 'danger', message: clientError.message });
      if (clientError.code === 'CURRICULUM_VERSION_CONFLICT') {
        void refreshEnrollment(variables.enrollmentId);
      }
    },
  });

  return {
    completeBlock: (variables: Omit<CompletionVariables, 'action'>) =>
      completionMutation.mutate({ ...variables, action: 'completeBlock' }),
    reopenBlock: (variables: Omit<CompletionVariables, 'action'>) =>
      completionMutation.mutate({ ...variables, action: 'reopenBlock' }),
    completeLesson: (variables: Omit<CompletionVariables, 'action'>) =>
      completionMutation.mutate({ ...variables, action: 'completeLesson' }),
    reopenLesson: (variables: Omit<CompletionVariables, 'action'>) =>
      completionMutation.mutate({ ...variables, action: 'reopenLesson' }),
    recordVisit: visitMutation.mutate,
    completionMutation,
    visitMutation,
  };
}
