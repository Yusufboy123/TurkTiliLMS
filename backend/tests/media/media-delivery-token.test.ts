import { MediaDeliveryTokenService } from '../../src/modules/media/media-delivery-token.js';

describe('MediaDeliveryTokenService', () => {
  it('accepts a valid scoped token and rejects tampering or expiry', () => {
    const service = new MediaDeliveryTokenService('test-secret');
    const issued = service.create('media-1', 'student-1', 1_000);

    expect(service.verify(issued.token, 1_001)).toMatchObject({ mediaId: 'media-1', userId: 'student-1', expiresAt: 1_300 });
    expect(service.verify(`${issued.token}x`, 1_001)).toBeNull();
    expect(service.verify(issued.token, 1_300)).toBeNull();
  });
});
