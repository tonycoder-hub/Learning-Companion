import {
  HARMONY_READER_VIEW_SCHEMA,
  HarmonyReaderView,
  TopicSummary
} from './workspace';

export function createEmptyReaderView(nowIso: string): HarmonyReaderView {
  return {
    schema: HARMONY_READER_VIEW_SCHEMA,
    generatedAt: nowIso,
    mode: 'native-scaffold',
    localDayWindow: {
      start: nowIso,
      end: nowIso,
      label: 'today',
      timeZone: 'local'
    },
    workspace: {
      schema: '',
      schemaVersion: 0,
      clientId: '',
      sessionCount: 0,
      openQuestionCount: 0,
      parkedQuestionCount: 0,
      unresolvedQuestionCount: 0,
      answerCaptureCountToday: 0,
      activeTopicId: ''
    },
    activeTopic: undefined,
    readerNextAction: {
      kind: 'import_reader_view',
      label: 'Import mirror JSON',
      detail: 'When the device picker is wired, choose a workspace or mirror bundle before using the phone reader.',
      route: 'pages/ImportReceipt',
      routeLabel: 'View Import Contract',
      meta: 'JSON <= 5 MB; no live sync',
      secondary: 'Rejected files keep the previous reader view visible.',
      generatedAt: nowIso,
      surface: 'reader'
    },
    topics: [],
    dueReview: [],
    recentCaptures: [],
    openQuestions: [],
    parkedQuestions: [],
    answersToday: [],
    answersTodayOverflow: 0,
    limitations: [
      'DevEco scaffold only; import adapter is not device-verified.',
      'Phone writes export append-only patch JSON for Mac import.',
      'Live Feishu sync is out of scope for this scaffold.'
    ]
  };
}

export function summarizeReaderView(view: HarmonyReaderView): string {
  const topicCount = view.topics.length;
  const dueCount = view.dueReview.length;
  const questionCount = view.workspace.openQuestionCount;
  const parkedCount = view.workspace.parkedQuestionCount;
  const unresolvedCount = view.workspace.unresolvedQuestionCount;
  const answerCount = view.workspace.answerCaptureCountToday;
  const active = view.activeTopic?.title || 'No active topic';
  return `${active} · ${topicCount} topics · ${dueCount} due · ${questionCount} active · ${parkedCount} parked · ${unresolvedCount} unresolved · ${answerCount} answers today`;
}

export function topicById(view: HarmonyReaderView, topicId: string): TopicSummary | undefined {
  return view.topics.find((topic) => topic.id === topicId);
}
