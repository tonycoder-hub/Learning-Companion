@Component
export struct TopicDetail {
  build() {
    Column({ space: 12 }) {
      Text('Topic Detail')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text('This screen will render source, latest capture, notes preview, and capture count from HarmonyReaderView.topics.')
        .fontSize(14)
      Text('Current scaffold is read-only; capture export belongs to append-only patch JSON.')
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
