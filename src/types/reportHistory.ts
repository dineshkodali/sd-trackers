/**
 * Service User Report History & Super Admin Archive Management Types
 */

export interface ReportDownloadEvent {
  userId: string;
  userName: string;
  userRole?: string;
  timestamp: string;
  ip?: string;
}

export interface ServiceUserReportRecord {
  id: string;
  reportId?: string;
  suId: string;
  suName: string;
  suReference?: string;
  site: string;
  reportName: string;
  reportType: string;
  reportCategory: string;
  fileFormat: 'pdf' | 'docx' | 'xlsx' | 'csv' | string;
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  storageBucket?: string;
  storagePath?: string;
  status: 'Generated' | 'Saved' | 'Downloaded' | 'Archived';
  generatedById?: string;
  generatedByName: string;
  generatedByRole?: string;
  generatedAt: string;
  savedAt?: string;
  downloadedAt?: string;
  lastDownloadedAt?: string;
  downloadCount: number;
  downloadHistory?: ReportDownloadEvent[];
  isArchived: boolean;
  archivedAt?: string;
  archivedBy?: string;
  metadata?: Record<string, any>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackReportInput {
  reportId?: string;
  suId: string;
  suName: string;
  suReference?: string;
  site?: string;
  reportName: string;
  reportType?: string;
  reportCategory?: string;
  fileFormat: string;
  fileName: string;
  fileSize?: number;
  fileBlob?: Blob;
  fileDataUrl?: string;
  fileBase64?: string;
  status?: 'Generated' | 'Saved' | 'Downloaded' | 'Archived';
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ReportHistoryFilterOptions {
  search?: string;
  format?: string;
  category?: string;
  status?: string;
  sortBy?: 'newest' | 'oldest' | 'name' | 'downloads';
  includeArchived?: boolean;
}

