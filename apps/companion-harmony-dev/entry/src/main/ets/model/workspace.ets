export const WORKSPACE_SCHEMA = 'learning-companion.workspace.v1';
export const MIRROR_BUNDLE_SCHEMA = 'learning-companion.mirror-bundle.staging.v1';
export const HARMONY_READER_VIEW_SCHEMA = 'learning-companion.harmony-reader-view.v1';
export const MOBILE_INBOX_PATCH_SCHEMA = 'learning-companion.mobile-inbox-patch.v1';
export const REVIEW_PROGRESS_PATCH_SCHEMA = 'learning-companion.review-progress-patch.v1';
export const HARMONY_IMPORT_RECEIPT_SCHEMA = 'learning-companion.harmony-import-receipt.v1';

export type FocusActionKind = 'review' | 'synthesize' | 'capture' | 'continue';
export type MaterialType = 'article' | 'video' | 'doc' | 'course' | 'book' | 'other';
export type ReviewGrade = 'again' | 'good';

export interface FocusNextAction {
  kind: FocusActionKind;
  label: string;
  reason: string;
}

export interface TopicSummary {
  id: string;
  title: string;
  sourceTitle: string;
  sourceUrl: string;
  materialType: MaterialType;
  tags: string[];
  captureCount: number;
  reviewCardCount: number;
  dueReviewCount: number;
  nextAction: FocusNextAction;
  latestCapture?: CapturePreview;
}

export interface CapturePreview {
  id: string;
  summary: string;
  capturedAt: string;
  sourceTitle: string;
  sourceHref: string;
}

export interface DueReviewCard {
  sessionId: string;
  sessionTitle: string;
  cardId: string;
  prompt: string;
  answer: string;
  dueAt: string;
  strength: number;
}

export interface RecentCapture {
  sessionId: string;
  sessionTitle: string;
  captureId: string;
  quote: string;
  thought: string;
  capturedAt: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface HarmonyReaderView {
  schema: typeof HARMONY_READER_VIEW_SCHEMA;
  generatedAt: string;
  mode: 'read-only-prototype' | 'native-scaffold';
  workspace: {
    schema: string;
    schemaVersion: number;
    clientId: string;
    sessionCount: number;
    activeTopicId: string;
  };
  activeTopic?: TopicSummary;
  topics: TopicSummary[];
  dueReview: DueReviewCard[];
  recentCaptures: RecentCapture[];
  limitations: string[];
}

export interface HarmonyImportReceipt {
  schema: typeof HARMONY_IMPORT_RECEIPT_SCHEMA;
  ok: boolean;
  importedAt: string;
  sourceKind: string;
  sourceSchema: string;
  readerViewSchema?: string;
  topicCount?: number;
  dueReviewCount?: number;
  mode?: string;
  errorCode?: string;
  message?: string;
}

export interface MobileInboxPatch {
  schema: typeof MOBILE_INBOX_PATCH_SCHEMA;
  appVersion: number;
  patchId: string;
  createdAt: string;
  source: PatchSource;
  target: PatchTarget;
  captures: InboxCaptureDraft[];
}

export interface ReviewProgressPatch {
  schema: typeof REVIEW_PROGRESS_PATCH_SCHEMA;
  appVersion: number;
  patchId: string;
  createdAt: string;
  source: PatchSource;
  events: ReviewProgressEvent[];
}

export interface PatchSource {
  generatedBy: string;
  workspaceFingerprint: string;
  topicId: string;
  topicTitle: string;
}

export interface PatchTarget {
  topicId: string;
  topicTitle: string;
}

export interface InboxCaptureDraft {
  id: string;
  quote: string;
  thought: string;
  timestamp: string;
  sourceTitle: string;
  sourceUrl: string;
  materialType: MaterialType;
  tags: string;
  capturedAt: string;
}

export interface ReviewProgressEvent {
  id: string;
  sessionId: string;
  cardId: string;
  grade: ReviewGrade;
  reviewedAt: string;
  baseUpdatedAt: string;
  baseDueAt: string;
  baseStrength: number;
}
