import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherGroupsApi } from '../api/teacher-groups.api';
import type { GroupQuery } from '../types/teacher-groups.types';

const keys = {
  root: ['teacher-groups'] as const,
  list: (query: GroupQuery) => ['teacher-groups', 'list', query] as const,
  detail: (id: string) => ['teacher-groups', 'detail', id] as const,
  search: (id: string, q: string) => ['teacher-groups', 'search', id, q] as const,
};
export function useTeacherGroups(query: GroupQuery) {
  return useQuery({ queryKey: keys.list(query), queryFn: () => teacherGroupsApi.list(query) });
}
export function useTeacherGroup(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => teacherGroupsApi.get(id),
    enabled: Boolean(id),
  });
}
export function useSearchGroupStudents(id: string, search: string) {
  return useQuery({
    queryKey: keys.search(id, search),
    queryFn: () => teacherGroupsApi.searchStudents(id, search),
    enabled: Boolean(id && search.trim()),
    staleTime: 15_000,
  });
}
export function useCreateTeacherGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: teacherGroupsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.root }),
  });
}
export function useAddGroupStudent(groupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => teacherGroupsApi.addStudent(groupId, studentId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.detail(groupId) }),
  });
}
export function useRemoveGroupStudent(groupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => teacherGroupsApi.removeStudent(groupId, studentId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.detail(groupId) }),
  });
}
