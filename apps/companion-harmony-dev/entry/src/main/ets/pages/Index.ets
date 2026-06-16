import router from '@ohos.router';
import { harmonyScaffoldLabel, harmonyScaffoldText, summarizeReaderView } from '../model/harmonyReaderView';
import { describeReturnToMacContract } from '../services/exportPatch';
import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

@Entry
@Component
struct Index {
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const readerNext = readerView.readerNextAction;
    const secondaryAction = readerNext.secondaryAction;
    const returnToMac = describeReturnToMacContract();
    Column({ space: 14 }) {
      Text('Learning Companion')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
      Text(harmonyScaffoldLabel('Phone Next', '手机下一步'))
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
      Text(readerNext.label)
        .fontSize(17)
        .fontWeight(FontWeight.Medium)
        .fontColor('#2f6f5e')
      Text(readerNext.detail)
        .fontSize(14)
        .fontColor('#5f4b20')
      Text(harmonyScaffoldText(
        `${readerNext.meta} · As of ${readerNext.generatedAt}`,
        `${readerNext.meta} · 截至 ${readerNext.generatedAt}`
      ))
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
      Text(harmonyScaffoldLabel('Resume Here', '从这里继续'))
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

      Button(harmonyScaffoldLabel('Import Workspace or Mirror JSON', '导入工作区或镜像 JSON'))
        .enabled(false)
      Text(harmonyScaffoldLabel('Import reader / Return to Mac', '导入 reader / 返回 Mac'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
      Text(harmonyScaffoldText(
        'JSON <= 5 MB; workspace or mirror bundle only; show ImportReceipt for success or rejection.',
        'JSON 不超过 5 MB；仅接受工作区或镜像包；成功或拒绝都显示 ImportReceipt。'
      ))
        .fontSize(12)
        .fontColor('#666154')
      Text(harmonyScaffoldText(
        'Return patches are Mac-bound only; this phone reader rejects them and keeps the current reader view.',
        '返回补丁只带回 Mac；手机 reader 会拒绝它们并保留当前 reader view。'
      ))
        .fontSize(12)
        .fontColor('#7a5f2b')
      Text(returnToMac[0])
        .fontSize(12)
        .fontColor('#5f4b20')
      Text(returnToMac[2])
        .fontSize(12)
        .fontColor('#426254')

      Button(harmonyScaffoldLabel('Review Queue', '复习队列'))
        .onClick(() => router.pushUrl({ url: 'pages/ReviewQueue' }))

      if (readerView.answersToday.length > 0) {
        Text(harmonyScaffoldLabel('Answers Today', '今日回答'))
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(harmonyScaffoldText(
          `Showing ${Math.min(readerView.answersToday.length, 3)} of ${readerView.workspace.answerCaptureCountToday} · ${readerView.localDayWindow.label}`,
          `显示 ${Math.min(readerView.answersToday.length, 3)} / ${readerView.workspace.answerCaptureCountToday} · ${readerView.localDayWindow.label}`
        ))
          .fontSize(12)
          .fontColor('#666154')
        ForEach(readerView.answersToday.slice(0, 3), (answer) => {
          Text(`${answer.sessionTitle}: ${answer.thought}`)
            .fontSize(12)
            .fontColor('#426254')
        }, (answer) => answer.captureId)
      }

      if (readerView.openQuestions.length > 0) {
        Text(harmonyScaffoldLabel('Open Questions', '未解决问题'))
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(harmonyScaffoldText(
          `Showing ${Math.min(readerView.openQuestions.length, 3)} of ${readerView.workspace.openQuestionCount}`,
          `显示 ${Math.min(readerView.openQuestions.length, 3)} / ${readerView.workspace.openQuestionCount}`
        ))
          .fontSize(12)
          .fontColor('#666154')
        ForEach(readerView.openQuestions.slice(0, 3), (question) => {
          Text(`${question.sessionTitle}: ${question.thought}`)
            .fontSize(12)
            .fontColor('#5f4b20')
        }, (question) => question.captureId)
      }

      if (readerView.parkedQuestions.length > 0) {
        Text(harmonyScaffoldLabel('Parked Questions', '暂存问题'))
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(harmonyScaffoldText(
          `Showing ${Math.min(readerView.parkedQuestions.length, 3)} of ${readerView.workspace.parkedQuestionCount}`,
          `显示 ${Math.min(readerView.parkedQuestions.length, 3)} / ${readerView.workspace.parkedQuestionCount}`
        ))
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
            Text(harmonyScaffoldText(
              `${topic.captureCount} captures · ${topic.openQuestionCount} questions · ${topic.dueReviewCount} due · ${topic.nextAction.kind}`,
              `${topic.captureCount} 条摘录 · ${topic.openQuestionCount} 个问题 · ${topic.dueReviewCount} 张到期卡片 · ${topic.nextAction.kind}`
            ))
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
