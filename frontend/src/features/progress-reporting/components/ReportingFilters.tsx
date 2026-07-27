import type { FormEvent } from 'react';
import { Button, Card, FormField, Input, Select } from '../../../components';
import { progressReportingMessages } from '../../../locales/uz-Latn/progress-reporting';
import type { ProgressReportingQuery } from '../types/progress-reporting.types';

interface ReportingFiltersProps {
  admin?: boolean;
  query: ProgressReportingQuery;
  onApply: (query: ProgressReportingQuery) => void;
}

function value(form: FormData, name: string): string | undefined {
  const entry = form.get(name);
  return typeof entry === 'string' && entry.trim() ? entry.trim() : undefined;
}

export function ReportingFilters({ admin = false, query, onApply }: ReportingFiltersProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onApply({
      page: 1,
      pageSize: query.pageSize,
      sortBy: (value(form, 'sortBy') ?? 'lastActivityAt') as ProgressReportingQuery['sortBy'],
      sortDirection: (value(form, 'sortDirection') ?? 'desc') as 'asc' | 'desc',
      ...(value(form, 'search') ? { search: value(form, 'search') } : {}),
      ...(value(form, 'courseId') ? { courseId: value(form, 'courseId') } : {}),
      ...(value(form, 'studentId') ? { studentId: value(form, 'studentId') } : {}),
      ...(value(form, 'enrollmentStatus')
        ? {
            enrollmentStatus: value(
              form,
              'enrollmentStatus',
            ) as ProgressReportingQuery['enrollmentStatus'],
          }
        : {}),
      ...(value(form, 'progressState')
        ? {
            progressState: value(form, 'progressState') as ProgressReportingQuery['progressState'],
          }
        : {}),
    });
  };

  return (
    <Card className="mt-6" elevation="none">
      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={submit}>
        <FormField label={progressReportingMessages.filters.search}>
          <Input
            defaultValue={query.search}
            maxLength={100}
            name="search"
            placeholder={progressReportingMessages.filters.searchPlaceholder}
            type="search"
          />
        </FormField>
        {admin ? (
          <>
            <FormField label={progressReportingMessages.filters.courseId}>
              <Input defaultValue={query.courseId} name="courseId" />
            </FormField>
            <FormField label={progressReportingMessages.filters.studentId}>
              <Input defaultValue={query.studentId} name="studentId" />
            </FormField>
          </>
        ) : null}
        <FormField label={progressReportingMessages.filters.enrollmentStatus}>
          <Select defaultValue={query.enrollmentStatus ?? ''} name="enrollmentStatus">
            <option value="">{progressReportingMessages.filters.all}</option>
            <option value="ACTIVE">Faol</option>
            <option value="SUSPENDED">To‘xtatilgan</option>
            <option value="COMPLETED">Yakunlangan</option>
            <option value="CANCELLED">Bekor qilingan</option>
          </Select>
        </FormField>
        <FormField label={progressReportingMessages.filters.progressState}>
          <Select defaultValue={query.progressState ?? ''} name="progressState">
            <option value="">{progressReportingMessages.filters.all}</option>
            <option value="NOT_STARTED">Boshlanmagan</option>
            <option value="IN_PROGRESS">Jarayonda</option>
            <option value="COMPLETED">Yakunlangan</option>
          </Select>
        </FormField>
        <FormField label={progressReportingMessages.filters.sortBy}>
          <Select defaultValue={query.sortBy} name="sortBy">
            <option value="lastActivityAt">Oxirgi faollik</option>
            <option value="completedAt">Yakunlangan sana</option>
            <option value="percentage">Natija</option>
            <option value="enrolledAt">Enrollment sanasi</option>
            <option value="studentName">Talaba nomi</option>
          </Select>
        </FormField>
        <FormField label={progressReportingMessages.filters.direction}>
          <Select defaultValue={query.sortDirection} name="sortDirection">
            <option value="desc">{progressReportingMessages.filters.descending}</option>
            <option value="asc">{progressReportingMessages.filters.ascending}</option>
          </Select>
        </FormField>
        <div className="flex items-end">
          <Button type="submit" width="full">
            {progressReportingMessages.filters.apply}
          </Button>
        </div>
      </form>
    </Card>
  );
}
