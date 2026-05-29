import router from '@ohos.router';
import { createEmptyReaderView, summarizeReaderView } from '../model/harmonyReaderView';
import { HarmonyReaderView } from '../model/workspace';

@Entry
@Component
struct Index {
  @State private readerView: HarmonyReaderView = sampleReaderView();

  build() {
    Column({ space: 14 }) {
      Text('Learning Companion')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
      Text('Resume Here')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
      Text(summarizeReaderView(this.readerView))
        .fontSize(15)
        .fontColor('#5f4b20')

      Button('Import Workspace or Mirror JSON')
        .enabled(false)
      Text('Document picker wiring is a deferred device gate. Use sample-harmony-reader-view.json until DevEco validation.')
        .fontSize(12)
        .fontColor('#666154')

      Button('Review Queue')
        .onClick(() => router.pushUrl({ url: 'pages/ReviewQueue' }))

      if (this.readerView.openQuestions.length > 0) {
        Text('Open Questions')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
        Text(`Showing ${Math.min(this.readerView.openQuestions.length, 3)} of ${this.readerView.workspace.openQuestionCount}`)
          .fontSize(12)
          .fontColor('#666154')
        ForEach(this.readerView.openQuestions.slice(0, 3), (question) => {
          Text(`${question.sessionTitle}: ${question.thought}`)
            .fontSize(12)
            .fontColor('#5f4b20')
        }, (question) => question.captureId)
      }

      ForEach(this.readerView.topics, (topic) => {
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

function sampleReaderView(): HarmonyReaderView {
  const view = createEmptyReaderView('2026-05-29T07:20:00.000Z');
  view.topics = [{
    id: 'sample_topic',
    title: 'Import a mirror bundle to start',
    sourceTitle: 'Learning Companion',
    sourceUrl: '',
    materialType: 'doc',
    tags: ['sample'],
    captureCount: 0,
    reviewCardCount: 0,
    dueReviewCount: 0,
    openQuestionCount: 0,
    nextAction: {
      kind: 'capture',
      label: 'Capture next',
      detail: 'Import a workspace or mirror bundle before phone capture.',
      reason: 'No imported workspace is loaded yet.',
      focusMode: 'capture',
      tab: 'captures'
    },
    latestCapture: undefined
  }];
  view.activeTopic = view.topics[0];
  view.workspace.sessionCount = view.topics.length;
  view.workspace.openQuestionCount = 0;
  view.workspace.activeTopicId = view.activeTopic.id;
  return view;
}
