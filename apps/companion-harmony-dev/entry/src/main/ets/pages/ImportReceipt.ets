@Component
export struct ImportReceipt {
  build() {
    Column({ space: 12 }) {
      Text('Import Receipt')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text('Receipts must show accepted schema, topic count, due review count, limitations, and rejection reason.')
        .fontSize(14)
      Text('Accepted: JSON <= 5 MB with workspace or mirror bundle schema.')
        .fontSize(12)
        .fontColor('#426254')
      Text('Rejected error codes include INVALID_JSON, INVALID_FILE_SIZE, UNSUPPORTED_FILE_TYPE, PORTABLE_FILE_TOO_LARGE, UNSUPPORTED_PORTABLE_DATA, and PATCH_IMPORT_NOT_SUPPORTED_ON_READER.')
        .fontSize(12)
        .fontColor('#7a5f2b')
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
