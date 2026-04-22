import { apiGet } from './api';
import type { ForensicsReport } from '../types/forensics';

export function getForensicsReport(id: string) {
  return apiGet<ForensicsReport>(`/forensics/${id}`);
}
