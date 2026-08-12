export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export interface QuestionMessage { id: string; senderId: string; senderRole: 'STUDENT' | 'TEACHER'; body: string; createdAt: string; }
export interface QuestionThread { id: string; subject: string | null; status: QuestionStatus; student: { id: string; name: string }; teacher: { id: string; name: string }; course: { id: string; title: string; slug: string }; lesson: { id: string; title: string } | null; latestMessage: QuestionMessage | null; messages?: QuestionMessage[]; createdAt: string; updatedAt: string; }
export interface QuestionPage { items: QuestionThread[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }; }
