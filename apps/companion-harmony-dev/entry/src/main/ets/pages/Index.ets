import router from '@ohos.router';
import { summarizeReaderView } from '../model/harmonyReaderView';
import { describeImportPickerContract } from '../services/importPortableData';
import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

@Entry
@Component
struct Index {
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const readerNext = readerView.readerNextAction;
    const secondaryAction = readerNext.secondaryAction;
    Column({ space: 14 }) {
      Text('Learning Companion')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
      Text('Phone Next')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
      Text(readerNext.label)
        .fontSize(17)
        .fontWeight(FontWeight.Medium)
        .fontColor('#2f6f5e')
      Text(readerNext.detail)
        .fontSize(14)
        .fontColor('#5f4b20')
      Text(`${readerNext.meta} · As of ${readerNext.generatedAt}`)
        .fontSize(12)
        .fontColor('#666154')
      if (readerNext.secondary.length > 0) {
        Text(readerNext.secondary)
          .fontSize(12)
          .fontColor('#666154')
      }
      Button(readerNext.routeLabel)
        .onClick(() => router.pushUrl({ url: readerNext.route }))
      if (secondaryAction) {
        const secondaryParams = secondaryAction.routeParams || {};
        Text(secondaryAction.meta)
          .fontSize(12)
          .fontColor('#666154')
        Button(secondaryAction.routeLabel)
          .onClick(() => router.pushUrl({ url: secondaryAction.route, params: secondaryParams }))
      }
      Text('Resume Here')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
      Text(summarizeReaderView(readerView))
        .fontSize(15)
        .fontColor('#5f4b20')
      Text(summarizeReaderSessionState(this.readerSession))
        .fontSize(12)
        .fontColor('#666154')
      Text(this.readerSession.importStatus.message)
        .fontSize(12)
        .fontColor('#426254')

      Button('Import Workspace or Mirror JSON')
        .enabled(false)
      Text('Picker contract: JSON <= 5 MB; workspace or mirror bundle only; show ImportReceipt for every success or rejection.')
        .fontSize(12)
        .fontColor('#666154')
      Text(describeImportPickerContract()[3])
        .fontSize(12)
        .fontColor('#666154')

      Button('Review Queue')
        .onClick(() => router.pushUrl({ url: 'pages/ReviewQueue' }))

      if (readerView.answersToday.length > 0) {
        Text('Answers Today')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(`Showing ${Math.min(readerView.answersToday.length, 3)} of ${readerView.workspace.answerCaptureCountToday} · ${readerView.localDayWindow.label}`)
          .fontSize(12)
          .fontColor('#666154')
        ForEach(readerView.answersToday.slice(0, 3), (answer) => {
          Text(`${answer.sessionTitle}: ${answer.thought}`)
            .fontSize(12)
            .fontColor('#426254')
        }, (answer) => answer.captureId)
      }

      if (readerView.openQuestions.length > 0) {
        Text('Open Questions')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(`Showing ${Math.min(readerView.openQuestions.length, 3)} of ${readerView.workspace.openQuestionCount}`)
          .fontSize(12)
          .fontColor('#666154')
        ForEach(readerView.openQuestions.slice(0, 3), (question) => {
          Text(`${question.sessionTitle}: ${question.thought}`)
            .fontSize(12)
            .fontColor('#5f4b20')
        }, (question) => question.captureId)
      }

      if (readerView.parkedQuestions.length > 0) {
        Text('Parked Questions')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(`Showing ${Math.min(readerView.parkedQuestions.length, 3)} of ${readerView.workspace.parkedQuestionCount}`)
          .fontSize(12)
          .fontColor('#666154')
        ForEach(readerView.parkedQuestions.slice(0, 3), (question) => {
          Text(`${question.sessionTitle}: ${question.thought}`)
            .fontSize(12)
            .fontColor('#7a5f2b')
        }, (question) => question.captureId)
      }

      ForEach(readerView.topics, (topic) => {
        Row() {
          Column() {
            Text(topic.title).fontSize(16).fontWeight(FontWeight.Medium)
            Text(`${topic.captureCount} captures · ${topic.openQuestionCount} questions · ${topic.dueReviewCount} due · ${topic.nextAction.kind}`)
              .fontSize(12)
              .fontColor('#666154')
          }
          .alignItems(HorizontalAlign.Start)
          Blank()
        }
        .width('100%')
        .padding(12)
        .backgroundColor('#fffaf2')
        .borderRadius(8)
        .onClick(() => router.pushUrl({ url: 'pages/TopicDetail', params: { topicId: topic.id } }))
      }, (topic) => topic.id)
    }
    .alignItems(HorizontalAlign.Start)
    .padding(20)
    .width('100%')
    .height('100%')
    .backgroundColor('#f6f3ed')
  }
}
