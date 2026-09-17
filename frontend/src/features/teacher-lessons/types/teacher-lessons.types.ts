import type { Pagination } from '../../progress';

export type TeacherLessonType = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'LIVE';
export type TeacherLessonStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type TeacherLessonBlockType = 'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOCUMENT' | 'IMAGE' | 'LINK' | 'DOWNLOAD';

export interface TeacherSection {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  isPublished: boolean;
  deletedAt: string | null;
  lessonCount: number;
}

export interface TeacherLesson {
  id: string;
  courseId: string;
  section: {
    id: string;
    title: string;
    position: number;
    isPublished: boolean;
    deletedAt: string | null;
  };
  course: { id: string; title: string; slug: string };
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  lessonType: TeacherLessonType;
  position: number;
  durationMinutes: number | null;
  isPreview: boolean;
  masteryEnabled: boolean;
  masteryPassingPercentage: number;
  status: TeacherLessonStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TeacherLessonPage {
  items: TeacherLesson[];
  pagination: Pagination;
}

export interface TeacherContentBlock {
  id: string;
  lessonId: string;
  mediaFileId: string | null;
  media: TeacherMediaReference | null;
  blockType: TeacherLessonBlockType;
  title: string | null;
  description: string | null;
  position: number;
  isRequired: boolean;
  isVisible: boolean;
  textContent: string | null;
  sourceUrl: string | null;
  externalProvider: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  interactivePractice?: InteractivePracticeItem[];
  isPracticeHolder?: boolean;
  deletedAt: string | null;
}

export interface InteractivePracticeItem {
  id: string;
  stage: number;
  type: string;
  prompt: string;
  answer: string;
  explanation?: string;
  options?: string[];
}

export interface TeacherContentBlockPage {
  items: TeacherContentBlock[];
  pagination: Pagination;
}

export interface TeacherLessonListQuery {
  page: number;
  pageSize: number;
  includeDeleted: false;
  sortBy: 'position';
  sortDirection: 'asc';
}

export interface CreateTeacherLessonInput {
  sectionId: string;
  title: string;
  summary?: string;
  lessonType: TeacherLessonType;
  position?: number;
  isPreview: boolean;
  masteryEnabled?: boolean;
  masteryPassingPercentage?: number;
}

export interface UpdateTeacherLessonInput {
  title?: string;
  summary?: string | null;
  lessonType?: TeacherLessonType;
  isPreview?: boolean;
  masteryEnabled?: boolean;
  masteryPassingPercentage?: number;
}

export interface ReorderTeacherLessonInput {
  sectionId?: string;
  position: number;
}

export interface CreateTeacherSectionInput {
  title: string;
}

export interface CreateTeacherBlockInput {
  blockType: Extract<TeacherLessonBlockType, 'TEXT' | 'VIDEO' | 'AUDIO' | 'IMAGE'>;
  mediaFileId?: string;
  title?: string;
  textContent?: string;
  sourceUrl?: string;
  isRequired: boolean;
  isVisible: boolean;
}

export interface UpdateTeacherBlockInput {
  mediaFileId?: string | null;
  title?: string | null;
  textContent?: string | null;
  sourceUrl?: string | null;
  isRequired?: boolean;
}

export interface TeacherMediaReference {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  category: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  sizeBytes: string;
  downloadUrl: string | null;
  previewUrl: string | null;
  deletedAt: string | null;
}

export interface TeacherMediaFile extends TeacherMediaReference {
  storageProvider: 'LOCAL';
}

export type TeacherQuizQuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD';

export interface TeacherVocabulary {
  id: string;
  lessonId: string;
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherVocabularyInput {
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence?: string | null;
  position?: number;
}

export type UpdateTeacherVocabularyInput = Partial<CreateTeacherVocabularyInput>;

export interface TeacherQuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface TeacherQuizQuestion {
  id: string;
  lessonId: string;
  type: TeacherQuizQuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  position: number;
  options: TeacherQuizOption[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherQuizOptionInput {
  text: string;
  isCorrect: boolean;
  position?: number;
}

export interface CreateTeacherQuizQuestionInput {
  type: TeacherQuizQuestionType;
  prompt: string;
  explanation?: string | null;
  points: number;
  position?: number;
  options?: TeacherQuizOptionInput[];
}

export type UpdateTeacherQuizQuestionInput = Partial<CreateTeacherQuizQuestionInput>;

export interface TeacherQuizResult {
  student: { id: string; name: string; email: string };
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  submittedAt: string | null;
}
