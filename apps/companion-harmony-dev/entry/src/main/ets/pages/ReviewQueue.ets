import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

@Component
export struct ReviewQueue {
  @State private revealed: boolean = false;
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const firstCard = readerView.dueReview[0];
    Column({ space: 12 }) {
      Text('Review Queue')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text(summarizeReaderSessionState(this.readerSession))
        .fontSize(12)
        .fontColor('#666154')
      Text(`${readerView.dueReview.length} due cards from the accepted reader session.`)
        .fontSize(14)
      if (firstCard) {
        Text(firstCard.prompt)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
        Text(`${firstCard.sessionTitle} · due ${firstCard.dueAt} · strength ${firstCard.strength}`)
          .fontSize(12)
          .fontColor('#666154')
        Button(this.revealed ? 'Hide Answer' : 'Reveal Answer')
          .onClick(() => {
            this.revealed = !this.revealed;
          })
        if (this.revealed) {
          Text(firstCard.answer)
            .fontSize(14)
            .fontColor('#5f4b20')
        }
      } else {
        Text('No due cards in the scaffold sample. Import a workspace or mirror bundle to populate the queue.')
          .fontSize(14)
          .fontColor('#666154')
      }
      Text('Grading will export review-progress patches; it must not mutate Mac state directly.')
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
