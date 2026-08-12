import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { bookmarkIdSchema, bookmarkInputSchema, lessonIdSchema, noteSchema } from './student-productivity.schemas.js';
import type { StudentProductivityService } from './student-productivity.service.js';

function actor(request: Request) { const auth = (request as Request & { auth?: AuthenticatedPrincipal }).auth; if (!auth) throw new AppError('Kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED'); return { userId: auth.userId, roles: auth.roles }; }
export class StudentProductivityController {
  constructor(private readonly service: StudentProductivityService) {}
  listBookmarks = async (request: Request, response: Response): Promise<void> => { response.json({ success: true, message: 'Saqlanganlar olindi.', data: await this.service.listBookmarks(actor(request)) }); };
  createBookmark = async (request: Request, response: Response): Promise<void> => { response.status(201).json({ success: true, message: 'Saqlanganlarga qo‘shildi.', data: await this.service.createBookmark(actor(request), bookmarkInputSchema.parse(request.body)) }); };
  deleteBookmark = async (request: Request, response: Response) => { await this.service.deleteBookmark(actor(request), bookmarkIdSchema.parse(request.params).bookmarkId); response.status(204).send(); };
  getNote = async (request: Request, response: Response): Promise<void> => { response.json({ success: true, message: 'Qayd olindi.', data: await this.service.getNote(actor(request), lessonIdSchema.parse(request.params).lessonId) }); };
  saveNote = async (request: Request, response: Response): Promise<void> => { response.json({ success: true, message: 'Qayd saqlandi.', data: await this.service.saveNote(actor(request), lessonIdSchema.parse(request.params).lessonId, noteSchema.parse(request.body)) }); };
  deleteNote = async (request: Request, response: Response) => { await this.service.deleteNote(actor(request), lessonIdSchema.parse(request.params).lessonId); response.status(204).send(); };
}
