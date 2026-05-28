import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?
  private var webRoot: URL?

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

    if FileManager.default.fileExists(atPath: indexFile.path) {
      view.loadFileURL(indexFile, allowingReadAccessTo: webRoot)
    } else {
      showMissingWebRoot(indexFile)
    }

    NSApp.activate()
  }

  @objc private func fillCaptureFromClipboard(_ sender: Any?) {
    guard let text = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines),
          !text.isEmpty,
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

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
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

    let captureItem = NSMenuItem()
    let captureMenu = NSMenu(title: "Capture")
    let fillFromClipboard = NSMenuItem(
      title: "Fill Capture From Clipboard",
      action: #selector(fillCaptureFromClipboard(_:)),
      keyEquivalent: "v"
    )
    fillFromClipboard.keyEquivalentModifierMask = [.command, .shift]
    fillFromClipboard.target = self
    captureMenu.addItem(fillFromClipboard)
    captureItem.submenu = captureMenu
    mainMenu.addItem(captureItem)

    NSApp.mainMenu = mainMenu
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
