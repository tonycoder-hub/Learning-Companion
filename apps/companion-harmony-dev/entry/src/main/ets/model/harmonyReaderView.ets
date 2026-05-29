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
    workspace: {
      schema: '',
      schemaVersion: 0,
      clientId: '',
      sessionCount: 0,
      activeTopicId: ''
    },
    activeTopic: undefined,
    topics: [],
    dueReview: [],
    recentCaptures: [],
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
  const active = view.activeTopic?.title || 'No active topic';
  return `${active} · ${topicCount} topics · ${dueCount} due`;
}

export function topicById(view: HarmonyReaderView, topicId: string): TopicSummary | undefined {
  return view.topics.find((topic) => topic.id === topicId);
}
