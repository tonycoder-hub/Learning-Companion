import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

@Component
export struct TopicDetail {
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const topic = readerView.activeTopic || readerView.topics[0];
    Column({ space: 12 }) {
      Text('Topic Detail')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
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
      Text('Read-only topic detail: phone capture still exports append-only patch JSON for Mac import.')
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
