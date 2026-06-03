import {
  InboxCaptureDraft,
  MOBILE_INBOX_PATCH_SCHEMA,
  MobileInboxPatch,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  ReviewGrade,
  ReviewProgressPatch
} from '../model/workspace';

export interface PatchBuildOptions {
  patchId: string;
  nowIso: string;
  workspaceFingerprint: string;
  returnBaseFingerprint?: string;
  topicId: string;
  topicTitle: string;
}

export function describeReturnToMacContract(): string[] {
  return [
    'Phone work exports append-only return JSON; it does not mutate Mac state.',
    'Move the return file back by USB, AirDrop, email, file share, or manual Feishu Drive.',
    'Import on Mac from Today > Return Files, then export a fresh mirror for the next phone pass.'
  ];
}

export function buildInboxPatch(options: PatchBuildOptions, captures: Partial<InboxCaptureDraft>[]): MobileInboxPatch {
  return {
    schema: MOBILE_INBOX_PATCH_SCHEMA,
    appVersion: 1,
    patchId: options.patchId,
    createdAt: options.nowIso,
    source: {
      generatedBy: 'harmony-dev-scaffold',
      workspaceFingerprint: options.workspaceFingerprint,
      returnBaseFingerprint: options.returnBaseFingerprint || '',
      topicId: options.topicId,
      topicTitle: options.topicTitle
    },
    target: {
      topicId: options.topicId,
      topicTitle: options.topicTitle
    },
    captures: captures.map((capture, index) => ({
      id: capture.id || `${options.patchId}_capture_${index + 1}`,
      quote: capture.quote || '',
      thought: capture.thought || '',
      timestamp: capture.timestamp || '',
      sourceTitle: capture.sourceTitle || options.topicTitle,
      sourceUrl: capture.sourceUrl || '',
      materialType: capture.materialType || 'doc',
      tags: capture.tags || '',
      capturedAt: capture.capturedAt || options.nowIso
    }))
  };
}

export function buildReviewProgressPatch(options: PatchBuildOptions, events: Array<{
  cardId: string;
  grade: ReviewGrade;
  baseUpdatedAt: string;
  baseDueAt: string;
  baseStrength: number;
}>): ReviewProgressPatch {
  return {
    schema: REVIEW_PROGRESS_PATCH_SCHEMA,
    appVersion: 1,
    patchId: options.patchId,
    createdAt: options.nowIso,
    source: {
      generatedBy: 'harmony-dev-scaffold',
      workspaceFingerprint: options.workspaceFingerprint,
      returnBaseFingerprint: options.returnBaseFingerprint || '',
      topicId: options.topicId,
      topicTitle: options.topicTitle
    },
    events: events.map((event, index) => ({
      id: `${options.patchId}_event_${index + 1}`,
      sessionId: options.topicId,
      cardId: event.cardId,
      grade: event.grade,
      reviewedAt: options.nowIso,
      baseUpdatedAt: event.baseUpdatedAt,
      baseDueAt: event.baseDueAt,
      baseStrength: event.baseStrength
    }))
  };
}
