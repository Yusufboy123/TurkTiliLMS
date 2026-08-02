export interface AdminDashboardSummary {
  readonly generatedAt: string;
  readonly users: {
    readonly total: number;
    readonly active: number;
    readonly suspended: number;
    readonly deactivated: number;
    readonly deleted: number;
    readonly students: number;
    readonly teachers: number;
    readonly administrators: number;
  };
  readonly courses: {
    readonly total: number;
    readonly draft: number;
    readonly inReview: number;
    readonly published: number;
    readonly archived: number;
    readonly deleted: number;
  };
  readonly enrollments: {
    readonly total: number;
    readonly active: number;
    readonly suspended: number;
    readonly completed: number;
    readonly cancelled: number;
  };
  readonly progress: {
    readonly trackedEnrollments: number;
    readonly averageCompletionPercentage: number;
  };
  readonly certificates: {
    readonly total: number;
    readonly issued: number;
    readonly revoked: number;
  };
}

export interface AdminSummaryMetric {
  readonly label: string;
  readonly suffix?: string;
  readonly value: number;
}
