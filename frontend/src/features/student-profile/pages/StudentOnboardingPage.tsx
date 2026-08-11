import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Select } from '../../../components';
import { ProgressError, ProgressSkeleton } from '../../progress/components';
import { useStudentProfile, useUpdateStudentProfile } from '../hooks/use-student-profile';
import type {
  StudentAgeRange,
  StudentGender,
  StudentLearningGoal,
  StudentOnboardingLevel,
  StudentSkillFocus,
  StudentWeeklyStudyBand,
} from '../types/student-profile.types';

interface FormValues {
  currentLevel: StudentOnboardingLevel | '';
  learningGoal: StudentLearningGoal | '';
  ageRange: StudentAgeRange | '';
  gender: StudentGender | '';
  weeklyStudyBand: StudentWeeklyStudyBand | '';
  preferredSkillFocus: StudentSkillFocus | '';
}

const emptyValues: FormValues = {
  currentLevel: '',
  learningGoal: '',
  ageRange: '',
  gender: '',
  weeklyStudyBand: '',
  preferredSkillFocus: '',
};

const levelOptions: Array<[StudentOnboardingLevel, string]> = [
  ['UNKNOWN', 'Bilmayman / Boshlovchi'],
  ['A1', 'A1'],
  ['A2', 'A2'],
  ['B1', 'B1'],
  ['B2', 'B2'],
  ['C1', 'C1'],
  ['C2', 'C2'],
];
const goalOptions: Array<[StudentLearningGoal, string]> = [
  ['WORK', 'Ish'],
  ['STUDY', 'O‘qish'],
  ['EXAM', 'Imtihon'],
  ['TRAVEL', 'Sayohat'],
  ['DAILY_COMMUNICATION', 'Kundalik muloqot'],
  ['PERSONAL_DEVELOPMENT', 'Shaxsiy rivojlanish'],
  ['OTHER', 'Boshqa'],
];
const ageOptions: Array<[StudentAgeRange, string]> = [
  ['AGE_13_17', '13–17'],
  ['AGE_18_24', '18–24'],
  ['AGE_25_34', '25–34'],
  ['AGE_35_44', '35–44'],
  ['AGE_45_PLUS', '45+'],
];
const genderOptions: Array<[StudentGender, string]> = [
  ['MALE', 'Erkak'],
  ['FEMALE', 'Ayol'],
  ['PREFER_NOT_TO_SAY', 'Aytishni istamayman'],
];
const weeklyOptions: Array<[StudentWeeklyStudyBand, string]> = [
  ['HOURS_1_2', '1–2 soat'],
  ['HOURS_3_5', '3–5 soat'],
  ['HOURS_5_PLUS', '5+ soat'],
];
const skillOptions: Array<[StudentSkillFocus, string]> = [
  ['SPEAKING', 'Gapirish'],
  ['LISTENING', 'Tinglash'],
  ['READING', 'O‘qish'],
  ['WRITING', 'Yozish'],
  ['ALL', 'Hammasi'],
];

export default function StudentOnboardingPage() {
  const navigate = useNavigate();
  const profile = useStudentProfile();
  const update = useUpdateStudentProfile();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [requiredError, setRequiredError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setValues({
      currentLevel: profile.data.currentLevel,
      learningGoal: profile.data.learningGoal,
      ageRange: profile.data.ageRange ?? '',
      gender: profile.data.gender ?? '',
      weeklyStudyBand: profile.data.weeklyStudyBand ?? '',
      preferredSkillFocus: profile.data.preferredSkillFocus ?? '',
    });
  }, [profile.data]);

  if (profile.isPending) return <ProgressSkeleton cards={1} />;
  if (profile.isError) {
    return <ProgressError error={profile.error} onRetry={() => void profile.refetch()} />;
  }

  const set = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setRequiredError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.currentLevel || !values.learningGoal) {
      setRequiredError('Turk tili darajasi va o‘quv maqsadini tanlang.');
      return;
    }
    update.mutate(
      {
        currentLevel: values.currentLevel,
        learningGoal: values.learningGoal,
        ageRange: values.ageRange || null,
        gender: values.gender || null,
        weeklyStudyBand: values.weeklyStudyBand || null,
        preferredSkillFocus: values.preferredSkillFocus || null,
      },
      { onSuccess: () => navigate('/app', { replace: true }) },
    );
  };

  const skipOptional = () => {
    if (!values.currentLevel || !values.learningGoal) {
      setRequiredError('Avval daraja va o‘quv maqsadini tanlang.');
      return;
    }
    update.mutate(
      {
        currentLevel: values.currentLevel,
        learningGoal: values.learningGoal,
        ageRange: null,
        gender: null,
        weeklyStudyBand: null,
        preferredSkillFocus: null,
      },
      { onSuccess: () => navigate('/app', { replace: true }) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="relative overflow-hidden" padding="lg">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-action-primary-bg" />
        <p className="text-label-md text-brand-text">Boshlang‘ich sozlama</p>
        <h1 className="type-heading-1 mt-2">O‘qish rejangizni belgilang</h1>
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">
          Bu qisqa ma’lumotlar sizga mos o‘qish yo‘lini ko‘rsatishga yordam beradi.
        </p>
        <form className="mt-6 grid gap-5" onSubmit={submit}>
          {requiredError ? <p className="text-body-sm text-danger-text" role="alert">{requiredError}</p> : null}
          <FormField label="Turk tili darajasi" required>
            <Select aria-label="Turk tili darajasi" onChange={(event) => set('currentLevel', event.target.value as FormValues['currentLevel'])} value={values.currentLevel}>
              <option value="">Tanlang</option>
              {levelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="O‘quv maqsadi" required>
            <Select aria-label="O‘quv maqsadi" onChange={(event) => set('learningGoal', event.target.value as FormValues['learningGoal'])} value={values.learningGoal}>
              <option value="">Tanlang</option>
              {goalOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Yosh oralig‘i (ixtiyoriy)">
              <Select aria-label="Yosh oralig‘i" onChange={(event) => set('ageRange', event.target.value as FormValues['ageRange'])} value={values.ageRange}><option value="">Tanlamaslik</option>{ageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            </FormField>
            <FormField label="Jins (ixtiyoriy)">
              <Select aria-label="Jins" onChange={(event) => set('gender', event.target.value as FormValues['gender'])} value={values.gender}><option value="">Tanlamaslik</option>{genderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            </FormField>
            <FormField label="Haftalik vaqt (ixtiyoriy)">
              <Select aria-label="Haftalik o‘qish vaqti" onChange={(event) => set('weeklyStudyBand', event.target.value as FormValues['weeklyStudyBand'])} value={values.weeklyStudyBand}><option value="">Tanlamaslik</option>{weeklyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            </FormField>
            <FormField label="Ko‘nikma (ixtiyoriy)">
              <Select aria-label="Afzal ko‘nikma" onChange={(event) => set('preferredSkillFocus', event.target.value as FormValues['preferredSkillFocus'])} value={values.preferredSkillFocus}><option value="">Tanlamaslik</option>{skillOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            </FormField>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled={update.isPending} loading={update.isPending} type="submit">Davom etish</Button>
            <Button disabled={update.isPending} intent="secondary" onClick={skipOptional} type="button">Ixtiyoriylarini keyinroq</Button>
          </div>
          {update.isError ? <p className="text-body-sm text-danger-text" role="alert">Profilni saqlab bo‘lmadi. Qayta urinib ko‘ring.</p> : null}
        </form>
      </Card>
    </div>
  );
}
