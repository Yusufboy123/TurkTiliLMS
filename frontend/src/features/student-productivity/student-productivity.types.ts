export interface BookmarkItem { id: string; kind: 'LESSON' | 'VOCABULARY'; lessonId: string | null; vocabularyId: string | null; title: string; subtitle: string | null; courseTitle: string; targetUrl: string; createdAt: string }
export interface NoteItem { id: string; lessonId: string; content: string; createdAt: string; updatedAt: string }
