export const teacherGroupPaths = {
  list: '/teacher/groups',
  detail: (groupId: string) => `/teacher/groups/${groupId}`,
  detailPattern: '/teacher/groups/:groupId',
} as const;
