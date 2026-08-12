import { describe, expect, it } from 'vitest';
import { announcementSchema } from '../../src/modules/notifications/notification.schemas.js';

describe('notification schemas', () => {
  it('accepts internal targets and rejects external targets', () => {
    expect(announcementSchema.parse({ audience: 'STUDENT', title: 'Yangilik', message: 'Xabar', targetUrl: '/app/courses' }).targetUrl).toBe('/app/courses');
    expect(() => announcementSchema.parse({ audience: 'ALL', title: 'X', message: 'Y', targetUrl: 'https://example.test' })).toThrow();
  });
});
