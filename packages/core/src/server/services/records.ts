import "server-only";

import type { Viewer } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";

export type AdminRecordSummary = {
  totalUploads: number;
  transfersInProgress: number;
  openSessions: number;
  attention: {
    missingUploads: number;
    uploadFailed: number;
    metadataFailed: number;
    duplicateCandidates: number;
    unmatched: number;
    deviceMismatch: number;
    needsReview: number;
  };
};

export async function getAdminRecordSummary(viewer: Viewer): Promise<AdminRecordSummary> {
  void viewer;
  const db = database();
  const [summary] = await db<{
    totalUploads: number;
    transfersInProgress: number;
    openSessions: number;
    missingUploads: number;
    uploadFailed: number;
    metadataFailed: number;
    duplicateCandidates: number;
    unmatched: number;
    deviceMismatch: number;
    needsReview: number;
  }[]>`
    select
      (select count(*)::integer from egocapture.upload_intents) as total_uploads,
      (select count(*)::integer from egocapture.upload_intents intent
        where intent.transfer_status in ('created', 'uploading', 'reconciling')) as transfers_in_progress,
      (select count(*)::integer from egocapture.recording_sessions session
        where session.status = 'open') as open_sessions,
      (select count(*)::integer from egocapture.missing_assignments) as missing_uploads,
      (select count(*)::integer from egocapture.review_cases review
        where review.case_type = 'upload_failed' and review.status in ('open', 'in_review')) as upload_failed,
      (select count(*)::integer from egocapture.review_cases review
        where review.case_type = 'metadata_failed' and review.status in ('open', 'in_review')) as metadata_failed,
      (select count(*)::integer from egocapture.review_cases review
        where review.case_type = 'duplicate_candidate' and review.status in ('open', 'in_review')) as duplicate_candidates,
      (select count(*)::integer from egocapture.review_cases review
        where review.case_type = 'unmatched' and review.status in ('open', 'in_review')) as unmatched,
      (select count(*)::integer from egocapture.review_cases review
        where review.case_type = 'device_mismatch' and review.status in ('open', 'in_review')) as device_mismatch,
      (select count(*)::integer from egocapture.review_cases review
        where review.status in ('open', 'in_review')) as needs_review
  `;

  return {
    totalUploads: summary?.totalUploads ?? 0,
    transfersInProgress: summary?.transfersInProgress ?? 0,
    openSessions: summary?.openSessions ?? 0,
    attention: {
      missingUploads: summary?.missingUploads ?? 0,
      uploadFailed: summary?.uploadFailed ?? 0,
      metadataFailed: summary?.metadataFailed ?? 0,
      duplicateCandidates: summary?.duplicateCandidates ?? 0,
      unmatched: summary?.unmatched ?? 0,
      deviceMismatch: summary?.deviceMismatch ?? 0,
      needsReview: summary?.needsReview ?? 0,
    },
  };
}
