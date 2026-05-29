@Component
export struct ReviewQueue {
  @State private revealed: boolean = false;

  build() {
    Column({ space: 12 }) {
      Text('Review Queue')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
      Text('Due cards render from HarmonyReaderView.dueReview. Grading exports review-progress patches; it does not mutate Mac state directly.')
        .fontSize(14)
      Button(this.revealed ? 'Hide Answer' : 'Reveal Answer')
        .onClick(() => {
          this.revealed = !this.revealed;
        })
      if (this.revealed) {
        Text('Answer preview placeholder')
          .fontSize(14)
          .fontColor('#5f4b20')
      }
    }
    .alignItems(HorizontalAlign.Start)
    .padding(20)
    .width('100%')
    .height('100%')
    .backgroundColor('#f6f3ed')
  }
}
