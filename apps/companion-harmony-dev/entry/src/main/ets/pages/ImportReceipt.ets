@Component
export struct ImportReceipt {
  build() {
    Column({ space: 12 }) {
      Text('Import Receipt')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text('Receipts must show accepted schema, topic count, due review count, limitations, and rejection reason.')
        .fontSize(14)
      Text('Patch files are not imported here; they are exported for Mac-side conflict-aware import.')
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
