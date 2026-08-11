import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentProfileApi } from '../api/student-profile.api';
import type { StudentProfileInput } from '../types/student-profile.types';
import { studentProfileQueryKeys } from './student-profile-query-keys';

export function useStudentProfile() {
  return useQuery({
    queryKey: studentProfileQueryKeys.current(),
    queryFn: studentProfileApi.get,
  });
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentProfileInput) => studentProfileApi.update(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(studentProfileQueryKeys.current(), profile);
    },
  });
}
