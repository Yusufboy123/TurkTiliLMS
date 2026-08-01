import { z } from 'zod';

// The fixed endpoint has no query-driven behavior. Unknown query keys are
// deliberately stripped instead of creating an undocumented 422 response.
export const adminDashboardSummaryQuerySchema = z.object({});
