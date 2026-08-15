import type { TaskItem } from '../types'

export const tasks: TaskItem[] = [
  { taskId: 'celery-001', type: 'Document Indexing', target: 'New Leave Policy (Draft).docx', state: 'PROGRESS', progress: 65, retryCount: 0, message: 'Vectorizing...', createdAt: '2026-07-24 09:00:00' },
  { taskId: 'celery-002', type: 'Document Indexing', target: 'Reimbursement Form Template Guide.html', state: 'PROGRESS', progress: 82, retryCount: 0, message: 'Vectorizing...', createdAt: '2026-07-24 10:30:00' },
  { taskId: 'celery-003', type: 'Document Indexing', target: 'Attendance Management Policy v3.2.pdf', state: 'SUCCESS', progress: 100, retryCount: 0, message: 'Indexing complete', createdAt: '2026-07-22 14:31:00' },
  { taskId: 'celery-004', type: 'Reindex', target: 'Product A User Manual v4.0.pdf', state: 'SUCCESS', progress: 100, retryCount: 0, message: 'Reindexing complete', createdAt: '2026-07-23 10:00:00' },
  { taskId: 'celery-005', type: 'Document Indexing', target: 'Expatriate Attendance.pdf', state: 'FAILURE', progress: 42, retryCount: 3, message: 'PDF parsing failed: corrupted format', createdAt: '2026-07-24 08:05:00' },
  { taskId: 'celery-006', type: 'Document Indexing', target: 'Database Design Standards.pdf', state: 'SUCCESS', progress: 100, retryCount: 0, message: 'Indexing complete', createdAt: '2026-07-18 15:00:00' },
  { taskId: 'celery-007', type: 'Batch Evaluation', target: 'Technical Standards Dataset', state: 'SUCCESS', progress: 100, retryCount: 0, message: 'Evaluation complete', createdAt: '2026-07-21 17:00:00' },
  { taskId: 'celery-008', type: 'Batch Evaluation', target: 'Product Manual Quality Verification', state: 'PROGRESS', progress: 45, retryCount: 0, message: 'Running batch 3/8...', createdAt: '2026-07-24 11:00:00' },
  { taskId: 'celery-009', type: 'Document Indexing', target: 'Frontend React Coding Standards.md', state: 'SUCCESS', progress: 100, retryCount: 0, message: 'Indexing complete', createdAt: '2026-07-20 13:00:00' },
  { taskId: 'celery-010', type: 'Document Indexing', target: 'Microservice Architecture Review Template.docx', state: 'PENDING', progress: 0, retryCount: 0, message: 'Waiting to run', createdAt: '2026-07-24 11:15:00' },
]
