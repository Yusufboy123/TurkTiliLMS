export interface AdminActivityRecord {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface AdminActivityPage {
  items: AdminActivityRecord[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
