import { apiClient } from '../lib/api-client';

export interface HealthResponse {
  success: boolean;
  message: string;
}

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');

  return response.data;
}
