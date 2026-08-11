import { useState } from 'react';
import { FormField, Input } from '../../../components';
import { teacherLessonsApi } from '../api/teacher-lessons.api';
import type { TeacherMediaFile } from '../types/teacher-lessons.types';
import { validateTeacherMediaFile } from './teacher-media-upload.validation';

type MediaKind = 'AUDIO' | 'VIDEO' | 'IMAGE';

const accepted: Record<MediaKind, { extensions: string[]; accept: string; label: string }> = {
  AUDIO: { extensions: ['mp3', 'wav'], accept: '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav', label: 'MP3 yoki WAV' },
  VIDEO: { extensions: ['mp4'], accept: '.mp4,video/mp4', label: 'MP4' },
  IMAGE: { extensions: ['jpg', 'jpeg', 'png', 'webp'], accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', label: 'JPG, JPEG, PNG yoki WEBP' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
  return response ?? 'Faylni yuklab bo‘lmadi. Fayl turi va hajmini tekshiring.';
}

export function TeacherMediaUploadField({ kind, label = 'Fayl yuklash', onUploaded }: { kind: MediaKind; label?: string; onUploaded: (media: TeacherMediaFile) => void }) {
  const [selected, setSelected] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<TeacherMediaFile | null>(null);
  const policy = accepted[kind];

  const choose = (file: File | undefined) => {
    if (!file) return;
    setSelected(file);
    setUploaded(null);
    setError(null);
    setProgress(0);
    const validationError = validateTeacherMediaFile(file, kind);
    if (validationError) {
      setError(validationError);
      return;
    }
    void teacherLessonsApi.uploadMedia(file, setProgress).then((media) => {
      setUploaded(media);
      onUploaded(media);
    }).catch((reason: unknown) => setError(uploadError(reason)));
  };

  return <FormField description={`${policy.label}. Backend fayl turi va hajmini qayta tekshiradi.`} label={label}>
    <Input accept={policy.accept} aria-describedby={`${kind.toLowerCase()}-upload-status`} onChange={(event) => choose(event.target.files?.[0])} type="file" />
    <div className="mt-2 text-body-sm text-text-secondary" id={`${kind.toLowerCase()}-upload-status`} aria-live="polite">
      {selected ? <span className="break-all">Tanlangan: {selected.name} ({formatBytes(selected.size)})</span> : null}
      {selected && !uploaded && !error ? <span className="ml-2">Yuklanmoqda {progress}%</span> : null}
      {uploaded ? <span className="text-success-text"> Fayl yuklandi.</span> : null}
      {error ? <span className="text-danger-text" role="alert">{error}</span> : null}
    </div>
  </FormField>;
}
