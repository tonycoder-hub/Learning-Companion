import router from '@ohos.router';
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
      ? 'Open Questions Across Topics'
      : selectedSection === 'answers_today'
        ? 'Answers Today Across Topics'
        : 'Topic Overview';
    const returnToMac = describeReturnToMacContract();
    Column({ space: 12 }) {
      Text('Topic Detail')
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
      Text(topic ? topic.title : 'No imported topic')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
      Text(topic ? `${topic.captureCount} captures · ${topic.openQuestionCount} active questions · ${topic.parkedQuestionCount} parked · ${topic.dueReviewCount} due` : 'Import a workspace or mirror bundle first.')
        .fontSize(14)
      Text(topic ? `Next: ${topic.nextAction.label} · ${topic.nextAction.reason}` : 'No next action until a reader view is accepted.')
        .fontSize(14)
        .fontColor('#5f4b20')
      Text(topic?.latestCapture ? `Latest: ${topic.latestCapture.summary}` : 'No latest capture in the scaffold sample.')
        .fontSize(12)
        .fontColor('#426254')
      Text(topic ? `Source: ${topic.sourceTitle || 'Untitled source'} · ${topic.materialType}` : 'Source appears after import.')
        .fontSize(12)
        .fontColor('#666154')
      if (selectedSection === 'open_questions') {
        Text(`Showing ${Math.min(readerView.openQuestions.length, 3)} of ${readerView.workspace.openQuestionCount} open questions`)
          .fontSize(12)
          .fontColor('#666154')
        if (readerView.openQuestions.length === 0) {
          Text('No open questions in the imported reader view.')
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
        Text(`Showing ${Math.min(readerView.answersToday.length, 3)} of ${readerView.workspace.answerCaptureCountToday} answers today`)
          .fontSize(12)
          .fontColor('#666154')
        if (readerView.answersToday.length === 0) {
          Text('No answers today in the imported reader view.')
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
      Text('Manual Return')
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
