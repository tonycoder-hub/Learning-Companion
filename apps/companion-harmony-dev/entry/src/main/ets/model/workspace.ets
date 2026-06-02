export const WORKSPACE_SCHEMA = 'learning-companion.workspace.v1';
export const MIRROR_BUNDLE_SCHEMA = 'learning-companion.mirror-bundle.staging.v1';
export const HARMONY_READER_VIEW_SCHEMA = 'learning-companion.harmony-reader-view.v1';
export const MOBILE_INBOX_PATCH_SCHEMA = 'learning-companion.mobile-inbox-patch.v1';
export const REVIEW_PROGRESS_PATCH_SCHEMA = 'learning-companion.review-progress-patch.v1';
export const HARMONY_IMPORT_RECEIPT_SCHEMA = 'learning-companion.harmony-import-receipt.v1';

export type FocusActionKind = 'review' | 'synthesize' | 'capture' | 'continue' | 'open_source';
export type HarmonyReaderNextActionKind = 'review_queue' | 'answer_question' | 'read_answers' | 'resume_topic' | 'import_reader_view';
export type HarmonyReaderRoute = 'pages/ReviewQueue' | 'pages/TopicDetail' | 'pages/ImportReceipt';
export type HarmonyReaderSurface = 'reader';
export const HARMONY_READER_NEXT_ACTION_PRIORITY: HarmonyReaderNextActionKind[] = ['review_queue', 'answer_question', 'read_answers', 'resume_topic', 'import_reader_view'];
export type MaterialType = 'article' | 'video' | 'doc' | 'course' | 'book' | 'other';
export type ReviewGrade = 'again' | 'good';
export type AnswerReason = 'linked-question' | 'tagged-answer' | 'answer-prefix' | '';
export type AnsweredAtSource = 'capturedAt' | 'createdAt' | 'updatedAt-inbox-import' | '';

export interface FocusNextAction {
  kind: FocusActionKind;
  label: string;
  detail: string;
  reason: string;
  focusMode: string;
  tab: string;
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
  openQuestionCount: number;
  parkedQuestionCount: number;
  unresolvedQuestionCount: number;
  nextAction: FocusNextAction;
  latestCapture?: CapturePreview;
}

export interface HarmonyReaderNextAction {
  kind: HarmonyReaderNextActionKind;
  label: string;
  detail: string;
  route: HarmonyReaderRoute;
  routeLabel: string;
  meta: string;
  secondary: string;
  generatedAt: string;
  surface: HarmonyReaderSurface;
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

export interface LocalDayWindow {
  start: string;
  end: string;
  label: string;
  timeZone: string;
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
  isQuestion: boolean;
  isOpenQuestion: boolean;
  isParkedQuestion: boolean;
  questionResolvedAt: string;
  questionParkedAt: string;
}

export interface OpenQuestion {
  sessionId: string;
  sessionTitle: string;
  captureId: string;
  quote: string;
  thought: string;
  capturedAt: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface ParkedQuestion extends OpenQuestion {
  questionParkedAt: string;
}

export interface AnswerToday {
  sessionId: string;
  sessionTitle: string;
  captureId: string;
  quote: string;
  thought: string;
  capturedAt: string;
  answeredAt: string;
  answeredAtSource: AnsweredAtSource;
  answerReason: AnswerReason;
  questionCaptureId: string;
  questionThought: string;
  questionResolvedAt: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface HarmonyReaderView {
  schema: typeof HARMONY_READER_VIEW_SCHEMA;
  generatedAt: string;
  mode: 'read-only-prototype' | 'native-scaffold';
  localDayWindow: LocalDayWindow;
  workspace: {
    schema: string;
    schemaVersion: number;
    clientId: string;
    sessionCount: number;
    openQuestionCount: number;
    parkedQuestionCount: number;
    unresolvedQuestionCount: number;
    answerCaptureCountToday: number;
    activeTopicId: string;
  };
  activeTopic?: TopicSummary;
  readerNextAction: HarmonyReaderNextAction;
  topics: TopicSummary[];
  dueReview: DueReviewCard[];
  recentCaptures: RecentCapture[];
  openQuestions: OpenQuestion[];
  parkedQuestions: ParkedQuestion[];
  answersToday: AnswerToday[];
  answersTodayOverflow: number;
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
  answerCaptureCountToday?: number;
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
