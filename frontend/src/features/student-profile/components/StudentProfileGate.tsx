import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStudentProfile } from '../hooks/use-student-profile';

const onboardingPath = '/app/onboarding';

export function StudentProfileGate() {
  const location = useLocation();
  const profile = useStudentProfile();

  if (profile.isPending) {
    return <p role="status">Profil tekshirilmoqda…</p>;
  }
  if (profile.isError) {
    return <Outlet />;
  }
  if (
    location.pathname !== onboardingPath &&
    (!profile.data || !profile.data.onboardingCompletedAt)
  ) {
    return <Navigate replace state={{ from: location.pathname }} to={onboardingPath} />;
  }
  return <Outlet />;
}
