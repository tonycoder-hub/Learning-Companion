import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let webRoot = resolveWebRoot()
    let indexFile = webRoot.appendingPathComponent("index.html")
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()

    let view = WKWebView(frame: .zero, configuration: configuration)

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

    if FileManager.default.fileExists(atPath: indexFile.path) {
      view.loadFileURL(indexFile, allowingReadAccessTo: webRoot)
    } else if let fallback = URL(string: "http://127.0.0.1:5173/") {
      view.load(URLRequest(url: fallback))
    }

    NSApp.activate()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
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
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
