import AppKit
import Carbon.HIToolbox
import UniformTypeIdentifiers
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  private let maxWorkspaceImportBytes = 5_000_000
  private let clipboardCaptureHotKeyId: UInt32 = 1
  private var window: NSWindow?
  private var webView: WKWebView?
  private var webRoot: URL?
  private var clipboardCaptureHotKeyRef: EventHotKeyRef?
  private var clipboardCaptureEventHandler: EventHandlerRef?
  private var clipboardCaptureHotKeyStatusItem: NSMenuItem?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let webRoot = resolveWebRoot()
    let indexFile = webRoot.appendingPathComponent("index.html")
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()

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
    window.minSize = NSSize(width: 760, height: 560)
    window.contentView = view
    window.setFrameAutosaveName("LearningCompanionMainWindow")
    window.makeKeyAndOrderFront(nil)

    self.window = window
    self.webView = view
    self.webRoot = webRoot.standardizedFileURL
    installMainMenu()
    registerClipboardCaptureHotKey()

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
    captureClipboardText(text, promoteToReview: false)
  }

  @objc private func exportWorkspace(_ sender: Any?) {
    guard let webView else {
      NSSound.beep()
      return
    }

    webView.evaluateJavaScript("window.learningCompanionNative?.exportWorkspaceJson?.() || ''") { [weak self] result, error in
      guard error == nil, let json = result as? String, !json.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        self?.showError("Could not read the current workspace from the web view.")
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
    panel.title = "Import Learning Companion Workspace"
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
        showError("The selected workspace file is too large.")
        return
      }
      guard let json = String(data: data, encoding: .utf8) else {
        showError("The selected workspace file is not valid UTF-8 text.")
        return
      }
      importWorkspaceJson(json)
    } catch {
      showError("Could not read the selected workspace file.")
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func applicationWillTerminate(_ notification: Notification) {
    if let clipboardCaptureHotKeyRef {
      UnregisterEventHotKey(clipboardCaptureHotKeyRef)
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
    appMenu.addItem(NSMenuItem(title: "Quit Learning Companion", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    appItem.submenu = appMenu
    mainMenu.addItem(appItem)

    let fileItem = NSMenuItem()
    let fileMenu = NSMenu(title: "File")
    let importWorkspace = NSMenuItem(
      title: "Import Workspace...",
      action: #selector(importWorkspace(_:)),
      keyEquivalent: "o"
    )
    importWorkspace.target = self
    fileMenu.addItem(importWorkspace)
    let exportWorkspace = NSMenuItem(
      title: "Export Workspace...",
      action: #selector(exportWorkspace(_:)),
      keyEquivalent: "e"
    )
    exportWorkspace.keyEquivalentModifierMask = [.command, .shift]
    exportWorkspace.target = self
    fileMenu.addItem(exportWorkspace)
    fileItem.submenu = fileMenu
    mainMenu.addItem(fileItem)

    let captureItem = NSMenuItem()
    let captureMenu = NSMenu(title: "Capture")
    let saveClipboardCapture = NSMenuItem(
      title: "Save Clipboard as Capture",
      action: #selector(saveClipboardAsCapture(_:)),
      keyEquivalent: "c"
    )
    saveClipboardCapture.keyEquivalentModifierMask = [.command, .option, .control]
    saveClipboardCapture.target = self
    captureMenu.addItem(saveClipboardCapture)
    let fillFromClipboard = NSMenuItem(
      title: "Fill Capture From Clipboard",
      action: #selector(fillCaptureFromClipboard(_:)),
      keyEquivalent: "v"
    )
    fillFromClipboard.keyEquivalentModifierMask = [.command, .shift]
    fillFromClipboard.target = self
    captureMenu.addItem(NSMenuItem.separator())
    captureMenu.addItem(fillFromClipboard)
    captureMenu.addItem(NSMenuItem.separator())
    let hotKeyStatus = NSMenuItem(title: "Global Hotkey: registering...", action: nil, keyEquivalent: "")
    hotKeyStatus.isEnabled = false
    clipboardCaptureHotKeyStatusItem = hotKeyStatus
    captureMenu.addItem(hotKeyStatus)
    captureItem.submenu = captureMenu
    mainMenu.addItem(captureItem)

    NSApp.mainMenu = mainMenu
  }

  private func clipboardText() -> String? {
    guard let text = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !text.isEmpty else {
      return nil
    }
    return text
  }

  private func registerClipboardCaptureHotKey() {
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
              hotKeyId.signature == fourCharCode("LCAP"),
              hotKeyId.id == 1 else {
          return noErr
        }
        let delegate = Unmanaged<AppDelegate>.fromOpaque(userData).takeUnretainedValue()
        DispatchQueue.main.async {
          delegate.saveClipboardAsCapture(nil)
        }
        return noErr
      },
      1,
      &eventType,
      Unmanaged.passUnretained(self).toOpaque(),
      &clipboardCaptureEventHandler
    )
    guard handlerStatus == noErr else {
      updateClipboardCaptureHotKeyStatus("Global Hotkey: unavailable")
      fputs("Learning Companion: global clipboard hotkey handler registration failed (\(handlerStatus))\n", stderr)
      return
    }

    let hotKeyId = EventHotKeyID(signature: fourCharCode("LCAP"), id: clipboardCaptureHotKeyId)
    let modifiers = UInt32(cmdKey | optionKey | controlKey)
    let registerStatus = RegisterEventHotKey(
      UInt32(kVK_ANSI_C),
      modifiers,
      hotKeyId,
      GetApplicationEventTarget(),
      0,
      &clipboardCaptureHotKeyRef
    )
    if registerStatus == noErr {
      updateClipboardCaptureHotKeyStatus("Global Hotkey: Ctrl+Option+Cmd+C")
    } else {
      clipboardCaptureHotKeyRef = nil
      if let clipboardCaptureEventHandler {
        RemoveEventHandler(clipboardCaptureEventHandler)
        self.clipboardCaptureEventHandler = nil
      }
      updateClipboardCaptureHotKeyStatus("Global Hotkey: unavailable")
      fputs("Learning Companion: global clipboard hotkey registration failed (\(registerStatus))\n", stderr)
    }
  }

  private func updateClipboardCaptureHotKeyStatus(_ title: String) {
    clipboardCaptureHotKeyStatusItem?.title = title
  }

  private func captureClipboardText(_ text: String, promoteToReview: Bool) {
    guard let webView,
          let encoded = jsonStringLiteral(text) else {
      NSSound.beep()
      return
    }
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate()
    let promote = promoteToReview ? "true" : "false"
    let script = """
    (() => {
      const bridge = window.learningCompanionNative;
      if (!bridge || typeof bridge.captureClipboardText !== "function") return JSON.stringify({ ok: false, error: "bridge_unavailable" });
      const result = bridge.captureClipboardText(\(encoded), { promoteToReview: \(promote) });
      return JSON.stringify(result || { ok: false, error: "empty_result" });
    })()
    """
    webView.evaluateJavaScript(script) { [weak self] result, error in
      guard error == nil,
            let text = result as? String,
            let data = text.data(using: .utf8),
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            payload["ok"] as? Bool == true else {
        self?.showError("Could not save the clipboard text as a capture.")
        return
      }
    }
  }

  private func saveWorkspaceJson(_ json: String) {
    let panel = NSSavePanel()
    panel.title = "Export Learning Companion Workspace"
    panel.allowedContentTypes = [.json]
    panel.nameFieldStringValue = "learning-companion-workspace.json"

    guard panel.runModal() == .OK, let url = panel.url else {
      return
    }
    do {
      try json.write(to: url, atomically: true, encoding: .utf8)
    } catch {
      showError("Could not save the workspace file.")
    }
  }

  private func importWorkspaceJson(_ json: String) {
    guard let encoded = jsonStringLiteral(json) else {
      showError("Could not encode the selected workspace file.")
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
        self?.showError("Could not import the selected workspace file.")
        return
      }
      if payload["canceled"] as? Bool == true {
        return
      }
      if payload["ok"] as? Bool != true {
        self?.showError("Could not import the selected workspace file.")
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
    alert.messageText = "Learning Companion web app not found"
    alert.informativeText = "Expected index.html at \(indexFile.path). Run from the repository, or pass the companion-web path explicitly."
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
