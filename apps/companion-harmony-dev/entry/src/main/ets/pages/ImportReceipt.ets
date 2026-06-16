import { harmonyScaffoldLabel, harmonyScaffoldText } from '../model/harmonyReaderView';
import { describeReturnToMacContract } from '../services/exportPatch';

@Component
export struct ImportReceipt {
  build() {
    const returnToMac = describeReturnToMacContract();
    Column({ space: 12 }) {
      Text(harmonyScaffoldLabel('Import Receipt', '导入回执'))
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text(harmonyScaffoldText(
        'Receipts must show accepted schema, topic count, due review count, limitations, and rejection reason.',
        '回执必须显示接受的 schema、主题数、到期复习数、限制和拒绝原因。'
      ))
        .fontSize(14)
      Text(harmonyScaffoldText(
        'Accepted: JSON <= 5 MB with workspace or mirror bundle schema.',
        '接受：不超过 5 MB 且带有工作区或镜像包 schema 的 JSON。'
      ))
        .fontSize(12)
        .fontColor('#426254')
      Text(harmonyScaffoldText(
        'Rejected error codes include INVALID_JSON, INVALID_FILE_SIZE, UNSUPPORTED_FILE_TYPE, PORTABLE_FILE_TOO_LARGE, UNSUPPORTED_PORTABLE_DATA, and PATCH_IMPORT_NOT_SUPPORTED_ON_READER.',
        '拒绝错误码包括 INVALID_JSON、INVALID_FILE_SIZE、UNSUPPORTED_FILE_TYPE、PORTABLE_FILE_TOO_LARGE、UNSUPPORTED_PORTABLE_DATA 和 PATCH_IMPORT_NOT_SUPPORTED_ON_READER。'
      ))
        .fontSize(12)
        .fontColor('#7a5f2b')
      Text(harmonyScaffoldText(
        'Patch files are not imported here; they are exported for Mac-side conflict-aware import.',
        '这里不导入 patch 文件；它们用于导出后在 Mac 侧做冲突感知导入。'
      ))
        .fontSize(12)
        .fontColor('#666154')
      Text(harmonyScaffoldLabel('Next Phone Pass', '下一次手机使用'))
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor('#2f6f5e')
      Text(returnToMac[2])
        .fontSize(12)
        .fontColor('#426254')
    }
    .alignItems(HorizontalAlign.Start)
    .padding(20)
    .width('100%')
    .height('100%')
    .backgroundColor('#f6f3ed')
  }
}
