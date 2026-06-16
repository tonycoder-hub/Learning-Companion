import router from '@ohos.router';
import { harmonyScaffoldLabel, harmonyScaffoldText } from '../model/harmonyReaderView';
import { describeReturnToMacContract } from '../services/exportPatch';
import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

interface TopicDetailRouteParams {
  topicId?: string;
  section?: string;
}

function readTopicDetailRouteParams(): TopicDetailRouteParams {
  const params = router.getParams() as TopicDetailRouteParams;
  return params || {};
}

@Component
export struct TopicDetail {
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const routeParams = readTopicDetailRouteParams();
    const routeTopicId = routeParams ? routeParams['topicId'] || '' : '';
    const selectedSection = routeParams ? routeParams['section'] || '' : '';
    const routedTopic = routeTopicId.length > 0 ? readerView.topics.find((item) => item.id === routeTopicId) : undefined;
    const topic = routedTopic || readerView.activeTopic || readerView.topics[0];
    const sectionLabel = selectedSection === 'open_questions'
      ? harmonyScaffoldLabel('Open Questions Across Topics', '跨主题未解决问题')
      : selectedSection === 'answers_today'
        ? harmonyScaffoldLabel('Answers Today Across Topics', '跨主题今日回答')
        : harmonyScaffoldLabel('Topic Overview', '主题概览');
    const returnToMac = describeReturnToMacContract();
    Column({ space: 12 }) {
      Text(harmonyScaffoldLabel('Topic Detail', '主题详情'))
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      if (selectedSection.length > 0) {
        Text(sectionLabel)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#2f6f5e')
      }
      Text(summarizeReaderSessionState(this.readerSession))
        .fontSize(12)
        .fontColor('#666154')
      Text(topic ? topic.title : harmonyScaffoldLabel('No imported topic', '尚未导入主题'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
      Text(topic ? harmonyScaffoldText(
        `${topic.captureCount} captures · ${topic.openQuestionCount} active questions · ${topic.parkedQuestionCount} parked · ${topic.dueReviewCount} due`,
        `${topic.captureCount} 条摘录 · ${topic.openQuestionCount} 个活跃问题 · ${topic.parkedQuestionCount} 个暂存问题 · ${topic.dueReviewCount} 张到期卡片`
      ) : harmonyScaffoldText('Import a workspace or mirror bundle first.', '请先导入工作区或镜像包。'))
        .fontSize(14)
      Text(topic ? harmonyScaffoldText(
        `Next: ${topic.nextAction.label} · ${topic.nextAction.reason}`,
        `下一步：${topic.nextAction.label} · ${topic.nextAction.reason}`
      ) : harmonyScaffoldText('No next action until a reader view is accepted.', '接受 reader view 前没有下一步。'))
        .fontSize(14)
        .fontColor('#5f4b20')
      Text(topic?.latestCapture ? harmonyScaffoldText(
        `Latest: ${topic.latestCapture.summary}`,
        `最新：${topic.latestCapture.summary}`
      ) : harmonyScaffoldText('No latest capture in the scaffold sample.', '脚手架样例中没有最新摘录。'))
        .fontSize(12)
        .fontColor('#426254')
      Text(topic ? harmonyScaffoldText(
        `Source: ${topic.sourceTitle || 'Untitled source'} · ${topic.materialType}`,
        `来源：${topic.sourceTitle || '未命名来源'} · ${topic.materialType}`
      ) : harmonyScaffoldText('Source appears after import.', '导入后会显示来源。'))
        .fontSize(12)
        .fontColor('#666154')
      if (selectedSection === 'open_questions') {
        Text(harmonyScaffoldText(
          `Showing ${Math.min(readerView.openQuestions.length, 3)} of ${readerView.workspace.openQuestionCount} open questions`,
          `显示 ${Math.min(readerView.openQuestions.length, 3)} / ${readerView.workspace.openQuestionCount} 个未解决问题`
        ))
          .fontSize(12)
          .fontColor('#666154')
        if (readerView.openQuestions.length === 0) {
          Text(harmonyScaffoldText('No open questions in the imported reader view.', '导入的 reader view 中没有未解决问题。'))
            .fontSize(12)
            .fontColor('#5f4b20')
        } else {
          ForEach(readerView.openQuestions.slice(0, 3), (question) => {
            Text(`${question.sessionTitle}: ${question.thought}`)
              .fontSize(12)
              .fontColor('#5f4b20')
          }, (question) => question.captureId)
        }
      }
      if (selectedSection === 'answers_today') {
        Text(harmonyScaffoldText(
          `Showing ${Math.min(readerView.answersToday.length, 3)} of ${readerView.workspace.answerCaptureCountToday} answers today`,
          `显示 ${Math.min(readerView.answersToday.length, 3)} / ${readerView.workspace.answerCaptureCountToday} 条今日回答`
        ))
          .fontSize(12)
          .fontColor('#666154')
        if (readerView.answersToday.length === 0) {
          Text(harmonyScaffoldText('No answers today in the imported reader view.', '导入的 reader view 中没有今日回答。'))
            .fontSize(12)
            .fontColor('#426254')
        } else {
          ForEach(readerView.answersToday.slice(0, 3), (answer) => {
            Text(`${answer.sessionTitle}: ${answer.thought}`)
              .fontSize(12)
              .fontColor('#426254')
          }, (answer) => answer.captureId)
        }
      }
      Text(harmonyScaffoldLabel('Manual Return', '手动返回'))
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor('#2f6f5e')
      Text(returnToMac[0])
        .fontSize(12)
        .fontColor('#5f4b20')
      Text(returnToMac[2])
        .fontSize(12)
        .fontColor('#666154')
    }
    .alignItems(HorizontalAlign.Start)
    .padding(20)
    .width('100%')
    .height('100%')
    .backgroundColor('#f6f3ed')
  }
}
