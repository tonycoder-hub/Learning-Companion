import AppKit
import ApplicationServices
import Carbon.HIToolbox
import UniformTypeIdentifiers
import WebKit

private struct BrowserContext {
  let title: String
  let url: String
}

private enum SelectedTextCaptureState {
  case text(String)
  case emptySelection
  case unavailable
}

private enum AccessibilityStringAttribute {
  case value(String)
  case unavailable
}

private func nativeText(_ en: String, _ zh: String) -> String {
  let preferred = Locale.preferredLanguages.first?.lowercased() ?? ""
  return preferred.hasPrefix("zh") ? zh : en
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
  private let maxWorkspaceImportBytes = 5_000_000
  private let maxNativeSaveBytes = 25_000_000
  private let clipboardCaptureHotKeyId: UInt32 = 1
  private let selectedTextCaptureHotKeyId: UInt32 = 2
  private let standardMinSize = NSSize(width: 760, height: 560)
  private let sidecarMinSize = NSSize(width: 390, height: 560)
  private let standardFrameAutosaveName = "LearningCompanionMainWindow"
  private let sidecarFrameAutosaveName = "LearningCompanionSidecarWindow"
  private var window: NSWindow?
  private var webView: WKWebView?
  private var webRoot: URL?
  private var clipboardCaptureHotKeyRef: EventHotKeyRef?
  private var selectedTextCaptureHotKeyRef: EventHotKeyRef?
  private var clipboardCaptureEventHandler: EventHandlerRef?
  private var clipboardCaptureHotKeyStatusItem: NSMenuItem?
  private var selectedTextCaptureStatusItem: NSMenuItem?
  private var standardWindowFrame: NSRect?
  private var keepAboveOthersMenuItem: NSMenuItem?
  private var keepsWindowAboveOthers = false
  private var pendingWebSidecarLayout: Bool?
  private var lastObservedPasteboardChangeCount = NSPasteboard.general.changeCount

  func applicationDidFinishLaunching(_ notification: Notification) {
    let webRoot = resolveWebRoot()
    let indexFile = webRoot.appendingPathComponent("index.html")
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.userContentController.add(self, name: "learningCompanion")

    let view = WKWebView(frame: .zero, configuration: configuration)
    view.navigationDelegate = self
    view.uiDelegate = self

    let window = NSWindow(
      contentRect: NSRect(x: 80, y: 80, width: 1180, height: 820),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Learning Companion"
    window.minSize = standardMinSize
    window.contentView = view
    window.setFrameAutosaveName(standardFrameAutosaveName)
    window.makeKeyAndOrderFront(nil)

    self.window = window
    self.webView = view
    self.webRoot = webRoot.standardizedFileURL
    installMainMenu()
    registerCaptureHotKeys()

    if FileManager.default.fileExists(atPath: indexFile.path) {
      view.loadFileURL(indexFile, allowingReadAccessTo: webRoot)
    } else {
      showMissingWebRoot(indexFile)
    }

    NSApp.activate()
  }

  @objc private func fillCaptureFromClipboard(_ sender: Any?) {
    guard let text = clipboardText(),
          let encoded = jsonStringLiteral(text) else {
      NSSound.beep()
      return
    }

    window?.makeKeyAndOrderFront(nil)
    NSApp.activate()
    let script = """
    (() => {
      document.querySelector('[data-focus-mode="capture"]')?.click();
      const quote = document.querySelector("#quoteInput");
      const thought = document.querySelector("#thoughtInput");
      if (!quote) return false;
      quote.value = \(encoded);
      quote.dispatchEvent(new Event("input", { bubbles: true }));
      if (thought) thought.focus();
      else quote.focus();
      return true;
    })()
    """
    webView?.evaluateJavaScript(script) { result, error in
      if error != nil || (result as? Bool) == false {
        NSSound.beep()
      }
    }
  }

  @objc private func saveClipboardAsCapture(_ sender: Any?) {
    guard let text = clipboardText() else {
      NSSound.beep()
      return
    }
    let pasteboardChangeCount = NSPasteboard.general.changeCount
    captureClipboardText(text, promoteToReview: false, browserContext: frontmostBrowserContext(), captureSource: "clipboard") { [weak self] in
      self?.lastObservedPasteboardChangeCount = pasteboardChangeCount
    }
  }

  @objc private func saveSelectedTextAsCapture(_ sender: Any?) {
    let browserContext = frontmostBrowserContext()
    if !AXIsProcessTrusted() {
      requestAccessibilityPermission()
      updateSelectedTextCaptureStatus()
    }
    switch selectedTextFromFrontmostApplication() {
    case .text(let selectedText):
      let pasteboardChangeCount = NSPasteboard.general.changeCount
      captureClipboardText(selectedText, promoteToReview: false, browserContext: browserContext, captureSource: "selected-text") { [weak self] in
        self?.lastObservedPasteboardChangeCount = pasteboardChangeCount
      }
      return
    case .emptySelection:
      updateSelectedTextCaptureStatus(nativeText("Selected Text: no selection detected", "选中文本：未检测到选区"))
      NSSound.beep()
      return
    case .unavailable:
      break
    }
    updateSelectedTextCaptureStatus()
    guard let fallback = freshClipboardTextForSelectedFallback() else {
      updateSelectedTextCaptureStatus(nativeText("Selected Text: no selection/new clipboard", "选中文本：没有新选区/剪贴板"))
      NSSound.beep()
      return
    }
    let pasteboardChangeCount = NSPasteboard.general.changeCount
    captureClipboardText(fallback, promoteToReview: false, browserContext: browserContext, captureSource: "clipboard-fallback") { [weak self] in
      self?.lastObservedPasteboardChangeCount = pasteboardChangeCount
    }
  }

  @objc private func exportWorkspace(_ sender: Any?) {
    guard let webView else {
      NSSound.beep()
      return
    }

    webView.evaluateJavaScript("window.learningCompanionNative?.exportWorkspaceJson?.() || ''") { [weak self] result, error in
      guard error == nil, let json = result as? String, !json.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        self?.showError(nativeText("Could not read the current workspace from the web view.", "无法从 Web 视图读取当前工作区。"))
        return
      }
      self?.saveWorkspaceJson(json)
    }
  }

  @objc private func importWorkspace(_ sender: Any?) {
    guard webView != nil else {
      NSSound.beep()
      return
    }

    let panel = NSOpenPanel()
    panel.title = nativeText("Import Learning Companion Workspace", "导入 Learning Companion 工作区")
    panel.allowedContentTypes = [.json]
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.canChooseFiles = true

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    do {
      let data = try Data(contentsOf: url)
      guard data.count <= maxWorkspaceImportBytes else {
        showError(nativeText("The selected workspace file is too large.", "所选工作区文件过大。"))
        return
      }
      guard let json = String(data: data, encoding: .utf8) else {
        showError(nativeText("The selected workspace file is not valid UTF-8 text.", "所选工作区文件不是有效的 UTF-8 文本。"))
        return
      }
      importWorkspaceJson(json)
    } catch {
      showError(nativeText("Could not read the selected workspace file.", "无法读取所选工作区文件。"))
    }
  }

  @objc private func openMorningReviewPack(_ sender: Any?) {
    guard let reviewPack = morningReviewPackURL() else {
      showError(nativeText(
        "Morning review pack is not generated yet. Run `npm run demo:morning`, then try again.",
        "晨间复习包尚未生成。请先运行 `npm run demo:morning`，然后重试。"
      ))
      return
    }
    if !NSWorkspace.shared.open(reviewPack) {
      showError(nativeText("Could not open the morning review pack.", "无法打开晨间复习包。"))
    }
  }

  @objc private func enterSidecarWindow(_ sender: Any?) {
    guard let window else {
      NSSound.beep()
      return
    }
    if standardWindowFrame == nil {
      standardWindowFrame = window.frame
    }
    window.minSize = sidecarMinSize
    window.setFrameAutosaveName(sidecarFrameAutosaveName)
    positionWindowAsSidecar()
    window.makeKeyAndOrderFront(nil)
    NSApp.activate()
    requestWebSidecarLayout(true)
  }

  @objc private func restoreDeskWindow(_ sender: Any?) {
    guard let window else {
      NSSound.beep()
      return
    }
    window.minSize = standardMinSize
    if let standardWindowFrame {
      window.setFrame(standardWindowFrame, display: true, animate: true)
    }
    self.standardWindowFrame = nil
    window.setFrameAutosaveName(standardFrameAutosaveName)
    window.makeKeyAndOrderFront(nil)
    NSApp.activate()
    requestWebSidecarLayout(false)
  }

  @objc private func toggleKeepWindowAboveOthers(_ sender: Any?) {
    keepsWindowAboveOthers.toggle()
    window?.level = keepsWindowAboveOthers ? .floating : .normal
    keepAboveOthersMenuItem?.state = keepsWindowAboveOthers ? .on : .off
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func applicationWillTerminate(_ notification: Notification) {
    if let clipboardCaptureHotKeyRef {
      UnregisterEventHotKey(clipboardCaptureHotKeyRef)
    }
    if let selectedTextCaptureHotKeyRef {
      UnregisterEventHotKey(selectedTextCaptureHotKeyRef)
    }
    if let clipboardCaptureEventHandler {
      RemoveEventHandler(clipboardCaptureEventHandler)
    }
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }
    if isAllowedShellURL(url) {
      decisionHandler(.allow)
      return
    }
    if openExternally(url) {
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.cancel)
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = navigationAction.request.url, !isAllowedShellURL(url) {
      _ = openExternally(url)
    }
    return nil
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    applyPendingWebSidecarLayout(retry: true)
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "learningCompanion",
          let payload = message.body as? [String: Any],
          payload["type"] as? String == "saveTextFile",
          let requestId = payload["requestId"] as? String,
          let filename = payload["filename"] as? String,
          let text = payload["text"] as? String else {
      return
    }
    let mediaType = payload["mediaType"] as? String ?? "text/plain"
    saveTextFileFromWeb(requestId: requestId, filename: filename, mediaType: mediaType, text: text)
  }

  private func resolveWebRoot() -> URL {
    let fileManager = FileManager.default
    let cwd = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
    let arguments = CommandLine.arguments.dropFirst().map { URL(fileURLWithPath: $0, relativeTo: cwd).standardizedFileURL }
    let candidates = arguments + [
      cwd.appendingPathComponent("../companion-web").standardizedFileURL,
      cwd.appendingPathComponent("apps/companion-web").standardizedFileURL,
      cwd.appendingPathComponent("../apps/companion-web").standardizedFileURL
    ]
    return candidates.first { candidate in
      fileManager.fileExists(atPath: candidate.appendingPathComponent("index.html").path)
    } ?? candidates.first ?? cwd
  }

  private func installMainMenu() {
    let mainMenu = NSMenu(title: "Learning Companion")
    let appItem = NSMenuItem()
    let appMenu = NSMenu(title: "Learning Companion")
    appMenu.addItem(NSMenuItem(title: nativeText("Quit Learning Companion", "退出 Learning Companion"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    appItem.submenu = appMenu
    mainMenu.addItem(appItem)

    let fileItem = NSMenuItem()
    let fileMenu = NSMenu(title: nativeText("File", "文件"))
    let importWorkspace = NSMenuItem(
      title: nativeText("Import Workspace...", "导入工作区..."),
      action: #selector(importWorkspace(_:)),
      keyEquivalent: "o"
    )
    importWorkspace.target = self
    fileMenu.addItem(importWorkspace)
    let exportWorkspace = NSMenuItem(
      title: nativeText("Export Workspace...", "导出工作区..."),
      action: #selector(exportWorkspace(_:)),
      keyEquivalent: "e"
    )
    exportWorkspace.keyEquivalentModifierMask = [.command, .shift]
    exportWorkspace.target = self
    fileMenu.addItem(exportWorkspace)
    fileMenu.addItem(NSMenuItem.separator())
    let openMorningReview = NSMenuItem(
      title: nativeText("Open Morning Review Pack", "打开晨间复习包"),
      action: #selector(openMorningReviewPack(_:)),
      keyEquivalent: ""
    )
    openMorningReview.target = self
    fileMenu.addItem(openMorningReview)
    fileItem.submenu = fileMenu
    mainMenu.addItem(fileItem)

    let captureItem = NSMenuItem()
    let captureMenu = NSMenu(title: nativeText("Capture", "摘录"))
    let saveSelectedCapture = NSMenuItem(
      title: nativeText("Save Selected Text as Capture", "保存选中文本为摘录"),
      action: #selector(saveSelectedTextAsCapture(_:)),
      keyEquivalent: "x"
    )
    saveSelectedCapture.keyEquivalentModifierMask = [.command, .option, .control]
    saveSelectedCapture.target = self
    captureMenu.addItem(saveSelectedCapture)
    let saveClipboardCapture = NSMenuItem(
      title: nativeText("Save Clipboard as Capture", "保存剪贴板为摘录"),
      action: #selector(saveClipboardAsCapture(_:)),
      keyEquivalent: "c"
    )
    saveClipboardCapture.keyEquivalentModifierMask = [.command, .option, .control]
    saveClipboardCapture.target = self
    captureMenu.addItem(saveClipboardCapture)
    let fillFromClipboard = NSMenuItem(
      title: nativeText("Fill Capture From Clipboard", "从剪贴板填充摘录"),
      action: #selector(fillCaptureFromClipboard(_:)),
      keyEquivalent: "v"
    )
    fillFromClipboard.keyEquivalentModifierMask = [.command, .shift]
    fillFromClipboard.target = self
    captureMenu.addItem(NSMenuItem.separator())
    captureMenu.addItem(fillFromClipboard)
    captureMenu.addItem(NSMenuItem.separator())
    let hotKeyStatus = NSMenuItem(title: nativeText("Global Hotkey: registering...", "全局快捷键：正在注册..."), action: nil, keyEquivalent: "")
    hotKeyStatus.isEnabled = false
    clipboardCaptureHotKeyStatusItem = hotKeyStatus
    captureMenu.addItem(hotKeyStatus)
    let selectedTextStatus = NSMenuItem(title: selectedTextCaptureStatusTitle(), action: nil, keyEquivalent: "")
    selectedTextStatus.isEnabled = false
    selectedTextCaptureStatusItem = selectedTextStatus
    captureMenu.addItem(selectedTextStatus)
    captureItem.submenu = captureMenu
    mainMenu.addItem(captureItem)

    let windowItem = NSMenuItem()
    let windowMenu = NSMenu(title: nativeText("Window", "窗口"))
    let enterSidecar = NSMenuItem(
      title: nativeText("Enter Sidecar Window", "进入侧栏窗口"),
      action: #selector(enterSidecarWindow(_:)),
      keyEquivalent: "]"
    )
    enterSidecar.keyEquivalentModifierMask = [.command, .option]
    enterSidecar.target = self
    windowMenu.addItem(enterSidecar)
    let restoreDesk = NSMenuItem(
      title: nativeText("Restore Desk Window", "恢复桌面窗口"),
      action: #selector(restoreDeskWindow(_:)),
      keyEquivalent: "["
    )
    restoreDesk.keyEquivalentModifierMask = [.command, .option]
    restoreDesk.target = self
    windowMenu.addItem(restoreDesk)
    windowMenu.addItem(NSMenuItem.separator())
    let keepAbove = NSMenuItem(
      title: nativeText("Keep Window Above Others", "保持窗口置顶"),
      action: #selector(toggleKeepWindowAboveOthers(_:)),
      keyEquivalent: ""
    )
    keepAbove.target = self
    keepAboveOthersMenuItem = keepAbove
    windowMenu.addItem(keepAbove)
    windowItem.submenu = windowMenu
    mainMenu.addItem(windowItem)

    NSApp.mainMenu = mainMenu
  }

  private func clipboardText() -> String? {
    guard let text = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !text.isEmpty else {
      return nil
    }
    return text
  }

  private func freshClipboardTextForSelectedFallback() -> String? {
    let pasteboard = NSPasteboard.general
    guard pasteboard.changeCount != lastObservedPasteboardChangeCount,
          pasteboard.types?.contains(.string) == true else {
      return nil
    }
    return clipboardText()
  }

  private func registerCaptureHotKeys() {
    var eventType = EventTypeSpec(
      eventClass: OSType(kEventClassKeyboard),
      eventKind: UInt32(kEventHotKeyPressed)
    )
    let handlerStatus = InstallEventHandler(
      GetApplicationEventTarget(),
      { _, eventRef, userData in
        guard let eventRef,
              let userData else {
          return noErr
        }
        var hotKeyId = EventHotKeyID()
        let status = GetEventParameter(
          eventRef,
          EventParamName(kEventParamDirectObject),
          EventParamType(typeEventHotKeyID),
          nil,
          MemoryLayout<EventHotKeyID>.size,
          nil,
          &hotKeyId
        )
        guard status == noErr,
              hotKeyId.signature == fourCharCode("LCAP") else {
          return noErr
        }
        let delegate = Unmanaged<AppDelegate>.fromOpaque(userData).takeUnretainedValue()
        DispatchQueue.main.async {
          if hotKeyId.id == delegate.selectedTextCaptureHotKeyId {
            delegate.saveSelectedTextAsCapture(nil)
          } else if hotKeyId.id == delegate.clipboardCaptureHotKeyId {
            delegate.saveClipboardAsCapture(nil)
          }
        }
        return noErr
      },
      1,
      &eventType,
      Unmanaged.passUnretained(self).toOpaque(),
      &clipboardCaptureEventHandler
    )
    guard handlerStatus == noErr else {
      updateClipboardCaptureHotKeyStatus(nativeText("Global Hotkey: unavailable", "全局快捷键：不可用"))
      fputs("Learning Companion: global clipboard hotkey handler registration failed (\(handlerStatus))\n", stderr)
      return
    }

    let clipboardStatus = registerCaptureHotKey(
      id: clipboardCaptureHotKeyId,
      keyCode: UInt32(kVK_ANSI_C),
      ref: &clipboardCaptureHotKeyRef
    )
    if clipboardStatus == noErr {
      updateClipboardCaptureHotKeyStatus(nativeText("Global Hotkey: Ctrl+Option+Cmd+C", "全局快捷键：Ctrl+Option+Cmd+C"))
    } else {
      clipboardCaptureHotKeyRef = nil
      updateClipboardCaptureHotKeyStatus(nativeText("Global Hotkey: unavailable", "全局快捷键：不可用"))
      fputs("Learning Companion: global clipboard hotkey registration failed (\(clipboardStatus))\n", stderr)
    }

    let selectedStatus = registerCaptureHotKey(
      id: selectedTextCaptureHotKeyId,
      keyCode: UInt32(kVK_ANSI_X),
      ref: &selectedTextCaptureHotKeyRef
    )
    if selectedStatus == noErr {
      updateSelectedTextCaptureStatus()
    } else {
      selectedTextCaptureHotKeyRef = nil
      updateSelectedTextCaptureStatus(nativeText("Selected Text: hotkey unavailable", "选中文本：快捷键不可用"))
      fputs("Learning Companion: selected text hotkey registration failed (\(selectedStatus))\n", stderr)
    }

    if clipboardCaptureHotKeyRef == nil && selectedTextCaptureHotKeyRef == nil {
      if let clipboardCaptureEventHandler {
        RemoveEventHandler(clipboardCaptureEventHandler)
        self.clipboardCaptureEventHandler = nil
      }
    }
  }

  private func registerCaptureHotKey(id: UInt32, keyCode: UInt32, ref: inout EventHotKeyRef?) -> OSStatus {
    let hotKeyId = EventHotKeyID(signature: fourCharCode("LCAP"), id: id)
    let modifiers = UInt32(cmdKey | optionKey | controlKey)
    return RegisterEventHotKey(
      keyCode,
      modifiers,
      hotKeyId,
      GetApplicationEventTarget(),
      0,
      &ref
    )
  }

  private func updateClipboardCaptureHotKeyStatus(_ title: String) {
    clipboardCaptureHotKeyStatusItem?.title = title
  }

  private func updateSelectedTextCaptureStatus(_ fallbackTitle: String? = nil) {
    selectedTextCaptureStatusItem?.title = fallbackTitle ?? selectedTextCaptureStatusTitle()
  }

  private func selectedTextCaptureStatusTitle() -> String {
    AXIsProcessTrusted()
      ? nativeText("Selected Text: Ctrl+Option+Cmd+X", "选中文本：Ctrl+Option+Cmd+X")
      : nativeText("Selected Text: needs Accessibility permission", "选中文本：需要辅助功能权限")
  }

  private func requestAccessibilityPermission() {
    let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
    _ = AXIsProcessTrustedWithOptions(options)
  }

  private func captureClipboardText(
    _ text: String,
    promoteToReview: Bool,
    browserContext: BrowserContext? = nil,
    captureSource: String = "clipboard",
    onSuccess: (() -> Void)? = nil
  ) {
    guard let webView,
          let encoded = jsonStringLiteral(text) else {
      NSSound.beep()
      return
    }
    var options: [String: Any] = [
      "promoteToReview": promoteToReview,
      "captureSource": captureSource
    ]
    if let browserContext {
      options["sourceTitle"] = browserContext.title
      options["sourceUrl"] = browserContext.url
    }
    guard let optionsLiteral = jsonObjectLiteral(options) else {
      NSSound.beep()
      return
    }
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate()
    let script = """
    (() => {
      const bridge = window.learningCompanionNative;
      if (!bridge || typeof bridge.captureClipboardText !== "function") return JSON.stringify({ ok: false, error: "bridge_unavailable" });
      const result = bridge.captureClipboardText(\(encoded), \(optionsLiteral));
      return JSON.stringify(result || { ok: false, error: "empty_result" });
    })()
    """
    webView.evaluateJavaScript(script) { [weak self] result, error in
      guard error == nil,
            let text = result as? String,
            let data = text.data(using: .utf8),
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            payload["ok"] as? Bool == true else {
        self?.showError(nativeText("Could not save the text as a capture.", "无法把文本保存为摘录。"))
        return
      }
      onSuccess?()
    }
  }

  private func frontmostBrowserContext() -> BrowserContext? {
    guard let appName = NSWorkspace.shared.frontmostApplication?.localizedName else {
      return nil
    }
    return browserContext(appName: appName)
  }

  private func browserContext(appName: String) -> BrowserContext? {
    if ["Google Chrome", "Brave Browser", "Microsoft Edge", "Arc", "Vivaldi", "Opera"].contains(appName) {
      return browserContextFromScript(appName: appName, scriptBody: """
      if not (exists front window) then return ""
      set tabTitle to title of active tab of front window
      set tabUrl to URL of active tab of front window
      return tabTitle & linefeed & tabUrl
      """)
    }
    if appName == "Safari" {
      return browserContextFromScript(appName: appName, scriptBody: """
      if not (exists front document) then return ""
      set tabTitle to name of front document
      set tabUrl to URL of front document
      return tabTitle & linefeed & tabUrl
      """)
    }
    return nil
  }

  private func browserContextFromScript(appName: String, scriptBody: String) -> BrowserContext? {
    let source = """
    tell application "\(appleScriptString(appName))"
    \(scriptBody)
    end tell
    """
    var error: NSDictionary?
    guard let output = NSAppleScript(source: source)?.executeAndReturnError(&error).stringValue else {
      return nil
    }
    let parts = output
      .split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
      .map(String.init)
    guard parts.count == 2 else {
      return nil
    }
    let title = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
    let url = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty || !url.isEmpty,
          url.hasPrefix("http://") || url.hasPrefix("https://") else {
      return nil
    }
    return BrowserContext(title: title, url: url)
  }

  private func selectedTextFromFrontmostApplication() -> SelectedTextCaptureState {
    guard AXIsProcessTrusted(),
          let app = NSWorkspace.shared.frontmostApplication,
          app.processIdentifier != ProcessInfo.processInfo.processIdentifier else {
      return .unavailable
    }
    let appElement = AXUIElementCreateApplication(app.processIdentifier)
    guard let focused = axAttribute(appElement, kAXFocusedUIElementAttribute) else {
      return .unavailable
    }
    switch axStringAttribute(focused, kAXSelectedTextAttribute) {
    case .value(let selectedText):
      let trimmed = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? .emptySelection : .text(trimmed)
    case .unavailable:
      return .unavailable
    }
  }

  private func axAttribute(_ element: AXUIElement, _ name: String) -> AXUIElement? {
    var value: CFTypeRef?
    let status = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    guard status == .success,
          let element = value,
          CFGetTypeID(element) == AXUIElementGetTypeID() else {
      return nil
    }
    return (element as! AXUIElement)
  }

  private func axStringAttribute(_ element: AXUIElement, _ name: String) -> AccessibilityStringAttribute {
    var value: CFTypeRef?
    let status = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    guard status == .success,
          let text = value as? String else {
      return .unavailable
    }
    return .value(text)
  }

  private func requestWebSidecarLayout(_ enabled: Bool) {
    pendingWebSidecarLayout = enabled
    applyPendingWebSidecarLayout(retry: true)
  }

  private func applyPendingWebSidecarLayout(retry: Bool) {
    guard let enabled = pendingWebSidecarLayout,
          let webView else {
      return
    }
    let value = enabled ? "true" : "false"
    let script = """
    (() => {
      const bridge = window.learningCompanionNative;
      if (!bridge || typeof bridge.setSidecarLayout !== "function") return JSON.stringify({ ok: false, error: "bridge_unavailable" });
      const result = bridge.setSidecarLayout(\(value));
      return JSON.stringify(result || { ok: false, error: "empty_result" });
    })()
    """
    webView.evaluateJavaScript(script) { [weak self] result, error in
      guard let self else {
        return
      }
      let ok: Bool
      if error == nil,
         let text = result as? String,
         let data = text.data(using: .utf8),
         let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        ok = payload["ok"] as? Bool == true
      } else {
        ok = false
      }
      if ok {
        self.pendingWebSidecarLayout = nil
      } else if retry {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
          self.applyPendingWebSidecarLayout(retry: false)
        }
      }
    }
  }

  private func positionWindowAsSidecar() {
    guard let window,
          let screen = window.screen ?? NSScreen.main else {
      return
    }
    let visibleFrame = screen.visibleFrame
    let width = min(max(430, sidecarMinSize.width), min(600, visibleFrame.width))
    let frame = NSRect(
      x: visibleFrame.maxX - width,
      y: visibleFrame.minY,
      width: width,
      height: visibleFrame.height
    )
    window.setFrame(frame, display: true, animate: true)
  }

  private func saveWorkspaceJson(_ json: String) {
    let panel = NSSavePanel()
    panel.title = nativeText("Export Learning Companion Workspace", "导出 Learning Companion 工作区")
    panel.allowedContentTypes = [.json]
    panel.nameFieldStringValue = "learning-companion-workspace.json"

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    do {
      try json.write(to: url, atomically: true, encoding: .utf8)
    } catch {
      showError(nativeText("Could not save the workspace file.", "无法保存工作区文件。"))
    }
  }

  private func saveTextFileFromWeb(requestId: String, filename: String, mediaType: String, text: String) {
    guard let data = text.data(using: .utf8), data.count <= maxNativeSaveBytes else {
      completeNativeSaveRequest(requestId, ok: false, error: "file_too_large")
      showError(nativeText("The export is too large to save from the app.", "导出内容过大，无法从应用保存。"))
      return
    }

    let panel = NSSavePanel()
    panel.title = nativeText("Save Learning Companion Export", "保存 Learning Companion 导出")
    panel.allowedContentTypes = allowedContentTypes(mediaType: mediaType, filename: filename)
    panel.nameFieldStringValue = safeSuggestedFilename(filename)

    guard panel.runModal() == .OK, let url = panel.url else {
      completeNativeSaveRequest(requestId, ok: false, error: "canceled")
      return
    }

    do {
      try data.write(to: url, options: .atomic)
      completeNativeSaveRequest(requestId, ok: true)
    } catch {
      completeNativeSaveRequest(requestId, ok: false, error: "write_failed")
      showError(nativeText("Could not save the export file.", "无法保存导出文件。"))
    }
  }

  private func completeNativeSaveRequest(_ requestId: String, ok: Bool, error: String = "") {
    guard let webView,
          let encodedRequestId = jsonStringLiteral(requestId),
          let result = jsonObjectLiteral(["ok": ok, "error": error]) else {
      return
    }
    webView.evaluateJavaScript("window.learningCompanionNative?.completeSaveRequest?.(\(encodedRequestId), \(result));")
  }

  private func allowedContentTypes(mediaType: String, filename: String) -> [UTType] {
    let lowerMediaType = mediaType.lowercased()
    let fileExtension = URL(fileURLWithPath: filename).pathExtension.lowercased()
    if lowerMediaType.contains("json") || fileExtension == "json" {
      return [.json]
    }
    if lowerMediaType.contains("markdown") || fileExtension == "md" {
      return [UTType(filenameExtension: "md") ?? .plainText]
    }
    if lowerMediaType.contains("html") || fileExtension == "html" {
      return [.html]
    }
    if let type = UTType(filenameExtension: fileExtension), !fileExtension.isEmpty {
      return [type]
    }
    return [.plainText]
  }

  private func safeSuggestedFilename(_ value: String) -> String {
    let name = URL(fileURLWithPath: value).lastPathComponent
      .components(separatedBy: CharacterSet.controlCharacters)
      .joined()
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if name.isEmpty {
      return "learning-companion-export.txt"
    }
    return String(name.prefix(160))
  }

  private func morningReviewPackURL() -> URL? {
    guard let webRoot else {
      return nil
    }
    let repoRoot = webRoot
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .standardizedFileURL
    let reviewPack = repoRoot
      .appendingPathComponent("dist/morning-demo/review-start-here.html")
      .standardizedFileURL
    return FileManager.default.fileExists(atPath: reviewPack.path) ? reviewPack : nil
  }

  private func importWorkspaceJson(_ json: String) {
    guard let encoded = jsonStringLiteral(json) else {
      showError(nativeText("Could not encode the selected workspace file.", "无法编码所选工作区文件。"))
      return
    }
    let script = """
    (() => {
      const bridge = window.learningCompanionNative;
      if (!bridge || typeof bridge.importWorkspaceJson !== "function") return JSON.stringify({ ok: false, error: "bridge_unavailable" });
      const result = bridge.importWorkspaceJson(\(encoded));
      return JSON.stringify(result || { ok: false, error: "empty_result" });
    })()
    """
    webView?.evaluateJavaScript(script) { [weak self] result, error in
      guard error == nil,
            let text = result as? String,
            let data = text.data(using: .utf8),
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        self?.showError(nativeText("Could not import the selected workspace file.", "无法导入所选工作区文件。"))
        return
      }
      if payload["canceled"] as? Bool == true {
        return
      }
      if payload["ok"] as? Bool != true {
        let message = payload["error"] as? String ?? nativeText("Could not import the selected workspace file.", "无法导入所选工作区文件。")
        self?.showError(message)
      }
    }
  }

  private func showError(_ message: String) {
    let alert = NSAlert()
    alert.messageText = "Learning Companion"
    alert.informativeText = message
    alert.alertStyle = .warning
    alert.runModal()
  }

  private func jsonStringLiteral(_ value: String) -> String? {
    guard JSONSerialization.isValidJSONObject([value]),
          let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
          let encoded = String(data: data, encoding: .utf8) else {
      return nil
    }
    return String(encoded.dropFirst().dropLast())
  }

  private func jsonObjectLiteral(_ value: [String: Any]) -> String? {
    guard JSONSerialization.isValidJSONObject(value),
          let data = try? JSONSerialization.data(withJSONObject: value, options: []),
          let encoded = String(data: data, encoding: .utf8) else {
      return nil
    }
    return encoded
  }

  private func appleScriptString(_ value: String) -> String {
    value
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
  }

  private func isAllowedShellURL(_ url: URL) -> Bool {
    let scheme = url.scheme?.lowercased()
    if scheme == "about" || scheme == "blob" {
      return true
    }
    guard url.isFileURL, let root = webRoot else {
      return false
    }
    let path = url.standardizedFileURL.path
    let rootPath = root.standardizedFileURL.path
    return path == rootPath || path.hasPrefix(rootPath + "/")
  }

  private func openExternally(_ url: URL) -> Bool {
    let scheme = url.scheme?.lowercased()
    guard scheme == "http" || scheme == "https" else {
      return false
    }
    NSWorkspace.shared.open(url)
    return true
  }

  private func showMissingWebRoot(_ indexFile: URL) {
    let alert = NSAlert()
    alert.messageText = nativeText("Learning Companion web app not found", "未找到 Learning Companion Web 应用")
    alert.informativeText = nativeText(
      "Expected index.html at \(indexFile.path). Run from the repository, or pass the companion-web path explicitly.",
      "预期在 \(indexFile.path) 找到 index.html。请从仓库运行，或显式传入 companion-web 路径。"
    )
    alert.runModal()
    NSApp.terminate(nil)
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()

private func fourCharCode(_ value: String) -> OSType {
  value.utf8.reduce(0) { result, character in
    (result << 8) + OSType(character)
  }
}
