type MediaKind = 'AUDIO' | 'VIDEO' | 'IMAGE';

const acceptedExtensions: Record<MediaKind, { extensions: string[]; label: string }> = {
  AUDIO: { extensions: ['mp3', 'wav'], label: 'MP3 yoki WAV' },
  VIDEO: { extensions: ['mp4'], label: 'MP4' },
  IMAGE: { extensions: ['jpg', 'jpeg', 'png', 'webp'], label: 'JPG, JPEG, PNG yoki WEBP' },
};

export function validateTeacherMediaFile(file: Pick<File, 'name'>, kind: MediaKind): string | null {
  const policy = acceptedExtensions[kind];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return policy.extensions.includes(extension) ? null : `Bu blok uchun faqat ${policy.label} fayllari qabul qilinadi.`;
}
