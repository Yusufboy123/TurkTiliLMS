export interface HealthStatus {
  success: true;
  message: string;
}

export const healthService = {
  getStatus(): HealthStatus {
    return {
      success: true,
      message: 'Turk Tili LMS API is running',
    };
  },
};
