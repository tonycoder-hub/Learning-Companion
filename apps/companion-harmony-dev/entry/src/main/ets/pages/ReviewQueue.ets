import { harmonyScaffoldLabel, harmonyScaffoldText } from '../model/harmonyReaderView';
import { describeReturnToMacContract } from '../services/exportPatch';
import { ReaderSessionState, createScaffoldReaderSession, createScaffoldSampleReaderView, summarizeReaderSessionState } from '../services/readerSessionState';

@Component
export struct ReviewQueue {
  @State private revealed: boolean = false;
  @State private readerSession: ReaderSessionState = createScaffoldReaderSession();

  build() {
    const readerView = this.readerSession.currentView || createScaffoldSampleReaderView();
    const firstCard = readerView.dueReview[0];
    const returnToMac = describeReturnToMacContract();
    Column({ space: 12 }) {
      Text(harmonyScaffoldLabel('Review Queue', '复习队列'))
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text(summarizeReaderSessionState(this.readerSession))
        .fontSize(12)
        .fontColor('#666154')
      Text(harmonyScaffoldText(
        `${readerView.dueReview.length} due cards from the accepted reader session.`,
        `已接受 reader session 中有 ${readerView.dueReview.length} 张到期卡片。`
      ))
        .fontSize(14)
      if (firstCard) {
        Text(firstCard.prompt)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
        Text(harmonyScaffoldText(
          `${firstCard.sessionTitle} · due ${firstCard.dueAt} · strength ${firstCard.strength}`,
          `${firstCard.sessionTitle} · 到期 ${firstCard.dueAt} · 强度 ${firstCard.strength}`
        ))
          .fontSize(12)
          .fontColor('#666154')
        Button(this.revealed ? harmonyScaffoldLabel('Hide Answer', '隐藏答案') : harmonyScaffoldLabel('Reveal Answer', '显示答案'))
          .onClick(() => {
            this.revealed = !this.revealed;
          })
        if (this.revealed) {
          Text(firstCard.answer)
            .fontSize(14)
            .fontColor('#5f4b20')
        }
      } else {
        Text(harmonyScaffoldText(
          'No due cards in the scaffold sample. Import a workspace or mirror bundle to populate the queue.',
          '脚手架样例中没有到期卡片。导入工作区或镜像包后会填充队列。'
        ))
          .fontSize(14)
          .fontColor('#666154')
      }
      Text(harmonyScaffoldLabel('Manual Return', '手动返回'))
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor('#2f6f5e')
      Text(harmonyScaffoldText(
        'Grades here are written into the return file; the Mac review queue changes only after Return Files import.',
        '这里的评分会写入返回文件；Mac 复习队列只会在导入 Return Files 后变化。'
      ))
        .fontSize(12)
        .fontColor('#5f4b20')
      Text(returnToMac[0])
        .fontSize(12)
        .fontColor('#666154')
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
