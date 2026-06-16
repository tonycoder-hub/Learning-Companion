import {
  HARMONY_READER_VIEW_SCHEMA,
  HarmonyReaderView,
  TopicSummary
} from './workspace';

export function harmonyScaffoldLabel(en: string, zh: string): string {
  return `${en} / ${zh}`;
}

export function harmonyScaffoldText(en: string, zh: string): string {
  return `${en}\n${zh}`;
}

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
      label: harmonyScaffoldLabel('Import mirror JSON', '导入镜像 JSON'),
      detail: harmonyScaffoldText(
        'When the device picker is wired, choose a workspace or mirror bundle before using the phone reader.',
        '接入设备文件选择器后，先选择工作区或镜像包，再使用手机 reader。'
      ),
      route: 'pages/ImportReceipt',
      routeLabel: harmonyScaffoldLabel('View Import Contract', '查看导入契约'),
      meta: harmonyScaffoldLabel('JSON <= 5 MB; no live sync', 'JSON 不超过 5 MB；无实时同步'),
      secondary: harmonyScaffoldText(
        'Rejected files keep the previous reader view visible.',
        '被拒绝的文件不会替换当前 reader view。'
      ),
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
      harmonyScaffoldText('DevEco scaffold only; import adapter is not device-verified.', '仅 DevEco 脚手架；导入适配器尚未真机验证。'),
      harmonyScaffoldText('Phone writes export append-only patch JSON for Mac import.', '手机侧写入会导出 append-only patch JSON，供 Mac 导入。'),
      harmonyScaffoldText('Live Feishu sync is out of scope for this scaffold.', '飞书实时同步不在此脚手架范围内。')
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
  const active = view.activeTopic?.title || harmonyScaffoldLabel('No active topic', '暂无活跃主题');
  return harmonyScaffoldText(
    `${active} · ${topicCount} topics · ${dueCount} due · ${questionCount} active · ${parkedCount} parked · ${unresolvedCount} unresolved · ${answerCount} answers today`,
    `${active} · ${topicCount} 个主题 · ${dueCount} 张到期卡片 · ${questionCount} 个活跃问题 · ${parkedCount} 个暂存问题 · ${unresolvedCount} 个未解决问题 · 今日 ${answerCount} 条回答`
  );
}

export function topicById(view: HarmonyReaderView, topicId: string): TopicSummary | undefined {
  return view.topics.find((topic) => topic.id === topicId);
}
