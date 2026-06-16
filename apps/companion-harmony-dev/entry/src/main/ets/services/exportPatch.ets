import {
  InboxCaptureDraft,
  MOBILE_INBOX_PATCH_SCHEMA,
  MobileInboxPatch,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  ReviewGrade,
  ReviewProgressPatch
} from '../model/workspace';
import { harmonyScaffoldText } from '../model/harmonyReaderView';

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
    harmonyScaffoldText('Phone work exports append-only return JSON; it does not mutate Mac state.', '手机侧工作会导出 append-only return JSON，不直接修改 Mac 状态。'),
    harmonyScaffoldText('Move the return file back by USB, AirDrop, email, file share, or manual Feishu Drive.', '通过 USB、AirDrop、邮件、文件共享或手动飞书云文档把 return file 带回。'),
    harmonyScaffoldText('Import on Mac from Today > Return Files, then export a fresh mirror for the next phone pass.', '在 Mac 的 Today > Return Files 导入，然后为下一轮手机使用导出新的镜像。')
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
