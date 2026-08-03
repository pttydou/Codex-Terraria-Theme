import AppKit
import UniformTypeIdentifiers

private enum Palette {
  static let ink = NSColor(calibratedRed: 0.93, green: 0.91, blue: 0.78, alpha: 1)
  static let muted = NSColor(calibratedRed: 0.66, green: 0.71, blue: 0.68, alpha: 1)
  static let cyan = NSColor(calibratedRed: 0.48, green: 0.73, blue: 0.63, alpha: 1)
  static let gold = NSColor(calibratedRed: 0.91, green: 0.72, blue: 0.28, alpha: 1)
  static let panel = NSColor(calibratedRed: 0.055, green: 0.12, blue: 0.18, alpha: 0.98)
  static let panelHover = NSColor(calibratedRed: 0.08, green: 0.17, blue: 0.24, alpha: 1)
  static let border = NSColor(calibratedRed: 0.39, green: 0.52, blue: 0.56, alpha: 0.92)
  static let borderLight = NSColor(calibratedRed: 0.61, green: 0.70, blue: 0.65, alpha: 0.72)
  static let groove = NSColor(calibratedRed: 0.015, green: 0.04, blue: 0.07, alpha: 0.86)
  static let danger = NSColor(calibratedRed: 0.95, green: 0.39, blue: 0.34, alpha: 1)
}

private struct ControlSnapshot: Decodable {
  let activeTheme: ActiveTheme
  let environments: [Environment]
  let random: RandomSettings
  let music: MusicSettings
}

private struct ActiveTheme: Decodable {
  let id: String
  let name: String
  let variant: String
}

private struct Environment: Decodable {
  let variant: String
  let name: String
  let includedInRandom: Bool
}

private struct RandomSettings: Decodable {
  let total: Int
  let excluded: [String]
  let enabledCount: Int
  let environmentIntervalMinutes: Int?
  let backgroundMode: String
  let backgroundIntervalMinutes: Int
}

private struct MusicSettings: Decodable {
  let enabled: Bool
  let volume: Int
  let playbackMode: String
  let trackGapSeconds: Int
  let fadeInSeconds: Double
  let pauseWhenHidden: Bool
  let environmentChangeMode: String
  let soundtrackMode: String
  let trackChangeMode: String
  let importedTotal: Int
  let slots: [MusicSlot]
}

private struct MusicSlot: Decodable {
  let id: String
  let name: String
  let imported: Int
}

private final class ControlProcess {
  private var running: Process?

  var isRunning: Bool {
    running?.isRunning == true
  }

  func run(arguments: [String], completion: @escaping (Result<Data, Error>) -> Void) {
    guard running == nil else {
      completion(.failure(ConsoleError.message("已有操作正在执行，请稍候。")))
      return
    }
    let engine = ProcessInfo.processInfo.environment["CODEX_DREAM_SKIN_ENGINE"]
      ?? NSString(string: "~/.codex/codex-dream-skin-studio").expandingTildeInPath
    let apiPath = URL(fileURLWithPath: engine)
      .appendingPathComponent("scripts/control-api-macos.sh").path
    guard FileManager.default.isExecutableFile(atPath: apiPath) else {
      completion(.failure(ConsoleError.message("皮肤引擎未安装或控制接口缺失，请重新运行安装程序。")))
      return
    }

    let process = Process()
    let stdout = Pipe()
    let stderr = Pipe()
    process.executableURL = URL(fileURLWithPath: "/bin/bash")
    process.arguments = [apiPath] + arguments
    process.standardOutput = stdout
    process.standardError = stderr
    running = process

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      do {
        try process.run()
        let output = stdout.fileHandleForReading.readDataToEndOfFile()
        let errorOutput = stderr.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        DispatchQueue.main.async {
          self?.running = nil
          if process.terminationStatus == 0 {
            completion(.success(output))
          } else {
            let detail = String(data: errorOutput, encoding: .utf8)?
              .trimmingCharacters(in: .whitespacesAndNewlines)
            completion(.failure(ConsoleError.message(
              detail?.isEmpty == false ? detail! : "操作未完成，请检查皮肤引擎状态。"
            )))
          }
        }
      } catch {
        DispatchQueue.main.async {
          self?.running = nil
          completion(.failure(error))
        }
      }
    }
  }
}

private enum ConsoleError: LocalizedError {
  case message(String)

  var errorDescription: String? {
    switch self {
    case .message(let message): return message
    }
  }
}

private final class PixelBackgroundView: NSView {
  private let image = NSImage(named: "ControlBackground")

  override func draw(_ dirtyRect: NSRect) {
    NSColor(calibratedRed: 0.025, green: 0.07, blue: 0.11, alpha: 1).setFill()
    bounds.fill()
    if let image {
      NSGraphicsContext.current?.imageInterpolation = .none
      image.draw(
        in: bounds,
        from: .zero,
        operation: .sourceOver,
        fraction: 0.40,
        respectFlipped: true,
        hints: nil
      )
    }
    NSColor(calibratedRed: 0.02, green: 0.055, blue: 0.09, alpha: 0.46).setFill()
    bounds.fill(using: .sourceOver)
  }
}

private final class FlippedView: NSView {
  override var isFlipped: Bool { true }
}

private final class PixelPanelView: NSView {
  var fillColor = Palette.panel

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func draw(_ dirtyRect: NSRect) {
    let outer = NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 4, yRadius: 4)
    fillColor.setFill()
    outer.fill()
    Palette.groove.setStroke()
    outer.lineWidth = 3
    outer.stroke()
    let inner = NSBezierPath(roundedRect: bounds.insetBy(dx: 3, dy: 3), xRadius: 2, yRadius: 2)
    Palette.border.setStroke()
    inner.lineWidth = 1
    inner.stroke()
  }
}

private final class PixelChevronView: NSView {
  override var intrinsicContentSize: NSSize {
    NSSize(width: 10, height: 16)
  }

  override func draw(_ dirtyRect: NSRect) {
    Palette.gold.setFill()
    [
      NSRect(x: 1, y: 2, width: 3, height: 3),
      NSRect(x: 4, y: 5, width: 3, height: 3),
      NSRect(x: 7, y: 8, width: 3, height: 3),
      NSRect(x: 4, y: 11, width: 3, height: 3),
    ].forEach { $0.fill() }
  }
}

private final class DashboardCard: NSControl {
  private let titleLabel = NSTextField(labelWithString: "")
  private let subtitleLabel = NSTextField(wrappingLabelWithString: "")
  private let iconView = NSImageView()
  private let arrowView = PixelChevronView()
  private var tracking: NSTrackingArea?
  private var hovered = false {
    didSet {
      needsDisplay = true
    }
  }

  init(title: String, subtitle: String, resource: String) {
    super.init(frame: .zero)
    wantsLayer = true
    titleLabel.stringValue = title
    titleLabel.font = .systemFont(ofSize: 16, weight: .bold)
    titleLabel.textColor = Palette.ink
    subtitleLabel.stringValue = subtitle
    subtitleLabel.font = .systemFont(ofSize: 11, weight: .medium)
    subtitleLabel.textColor = Palette.muted
    subtitleLabel.maximumNumberOfLines = 2
    subtitleLabel.lineBreakMode = .byWordWrapping
    iconView.image = NSImage(named: resource)
    iconView.imageScaling = .scaleProportionallyUpOrDown
    iconView.wantsLayer = true
    iconView.layer?.magnificationFilter = .nearest
    iconView.layer?.minificationFilter = .nearest
    setAccessibilityElement(true)
    setAccessibilityRole(.button)
    setAccessibilityLabel(title)

    [titleLabel, subtitleLabel, iconView, arrowView].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }
    NSLayoutConstraint.activate([
      iconView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
      iconView.centerYAnchor.constraint(equalTo: centerYAnchor),
      iconView.widthAnchor.constraint(equalToConstant: 44),
      iconView.heightAnchor.constraint(equalToConstant: 44),
      titleLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 14),
      titleLabel.trailingAnchor.constraint(equalTo: arrowView.leadingAnchor, constant: -10),
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 27),
      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
      subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
      arrowView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      arrowView.centerYAnchor.constraint(equalTo: centerYAnchor),
      arrowView.widthAnchor.constraint(equalToConstant: 12),
      arrowView.heightAnchor.constraint(equalToConstant: 18),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func updateTrackingAreas() {
    if let tracking { removeTrackingArea(tracking) }
    tracking = NSTrackingArea(
      rect: bounds,
      options: [.activeInKeyWindow, .mouseEnteredAndExited],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(tracking!)
    super.updateTrackingAreas()
  }

  override func mouseEntered(with event: NSEvent) { hovered = true }
  override func mouseExited(with event: NSEvent) { hovered = false }

  override func mouseDown(with event: NSEvent) {
    guard isEnabled else { return }
    layer?.opacity = 0.76
  }

  override func mouseUp(with event: NSEvent) {
    layer?.opacity = 1
    guard isEnabled, bounds.contains(convert(event.locationInWindow, from: nil)) else { return }
    sendAction(action, to: target)
  }

  override func accessibilityPerformPress() -> Bool {
    guard isEnabled else { return false }
    sendAction(action, to: target)
    return true
  }

  override func draw(_ dirtyRect: NSRect) {
    let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 2), xRadius: 4, yRadius: 4)
    (hovered ? Palette.panelHover : Palette.panel).setFill()
    path.fill()
    Palette.groove.setStroke()
    path.lineWidth = 4
    path.stroke()
    let inner = NSBezierPath(roundedRect: bounds.insetBy(dx: 4, dy: 4), xRadius: 2, yRadius: 2)
    (hovered ? Palette.borderLight : Palette.border).setStroke()
    inner.lineWidth = hovered ? 2 : 1
    inner.stroke()
    let accent = NSBezierPath(
      rect: NSRect(x: 9, y: 12, width: 3, height: bounds.height - 24)
    )
    Palette.gold.withAlphaComponent(hovered ? 0.92 : 0.64).setFill()
    accent.fill()
  }
}

private final class AppDelegate: NSObject, NSApplicationDelegate, NSSearchFieldDelegate,
  NSTableViewDataSource, NSTableViewDelegate {
  private let process = ControlProcess()
  private let decoder = JSONDecoder()
  private var snapshot: ControlSnapshot?
  private var window: NSWindow!
  private var background: PixelBackgroundView!
  private var content = FlippedView()
  private var titleLabel = NSTextField(labelWithString: "Codex 皮肤控制台")
  private var subtitleLabel = NSTextField(labelWithString: "Terraria × Codex")
  private var backButton = NSButton()
  private var statusLabel = NSTextField(labelWithString: "正在读取本机配置…")
  private var spinner = NSProgressIndicator()
  private var currentPage = "home"
  private var searchField: NSSearchField?
  private var environmentTable: NSTableView?
  private var filteredEnvironments: [Environment] = []
  private var environmentQuery = ""
  private var randomTable: NSTableView?
  private var randomIncluded: Set<String> = []
  private var randomIntervalPopup: NSPopUpButton?
  private var backgroundModePopup: NSPopUpButton?
  private var backgroundIntervalPopup: NSPopUpButton?
  private var enabledToggle: NSButton?
  private var volumeSlider: NSSlider?
  private var volumeLabel: NSTextField?
  private var playbackPopup: NSPopUpButton?
  private var gapPopup: NSPopUpButton?
  private var fadePopup: NSPopUpButton?
  private var hiddenToggle: NSButton?
  private var environmentModePopup: NSPopUpButton?
  private var soundtrackModePopup: NSPopUpButton?
  private var trackChangeModePopup: NSPopUpButton?
  private var slotPopup: NSPopUpButton?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    buildWindow()
    showHome()
    loadSnapshot()
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  private func buildWindow() {
    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 980, height: 690),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = "Codex 皮肤控制台"
    window.appearance = NSAppearance(named: .darkAqua)
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.minSize = NSSize(width: 820, height: 600)
    window.center()

    background = PixelBackgroundView()
    background.translatesAutoresizingMaskIntoConstraints = false
    window.contentView = background

    let header = NSView()
    header.wantsLayer = true
    header.layer?.backgroundColor = NSColor(
      calibratedRed: 0.035, green: 0.075, blue: 0.11, alpha: 0.98
    ).cgColor
    header.layer?.borderColor = Palette.border.withAlphaComponent(0.65).cgColor
    header.layer?.borderWidth = 1
    header.translatesAutoresizingMaskIntoConstraints = false
    background.addSubview(header)

    backButton = NSButton(
      image: NSImage(systemSymbolName: "chevron.left", accessibilityDescription: "返回")!,
      target: self,
      action: #selector(goHome)
    )
    backButton.bezelStyle = .texturedRounded
    backButton.isBordered = false
    backButton.contentTintColor = Palette.ink
    backButton.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(backButton)

    titleLabel.font = .systemFont(ofSize: 21, weight: .bold)
    titleLabel.textColor = Palette.ink
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(titleLabel)
    subtitleLabel.font = .systemFont(ofSize: 12, weight: .medium)
    subtitleLabel.textColor = Palette.muted
    subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
    header.addSubview(subtitleLabel)

    content.translatesAutoresizingMaskIntoConstraints = false
    background.addSubview(content)

    let statusPanel = PixelPanelView()
    statusPanel.translatesAutoresizingMaskIntoConstraints = false
    background.addSubview(statusPanel)
    spinner.style = .spinning
    spinner.controlSize = .small
    spinner.isDisplayedWhenStopped = false
    spinner.translatesAutoresizingMaskIntoConstraints = false
    statusPanel.addSubview(spinner)
    statusLabel.textColor = Palette.muted
    statusLabel.font = .systemFont(ofSize: 12, weight: .medium)
    statusLabel.lineBreakMode = .byTruncatingTail
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusPanel.addSubview(statusLabel)

    NSLayoutConstraint.activate([
      header.topAnchor.constraint(equalTo: background.topAnchor),
      header.leadingAnchor.constraint(equalTo: background.leadingAnchor),
      header.trailingAnchor.constraint(equalTo: background.trailingAnchor),
      header.heightAnchor.constraint(equalToConstant: 78),
      backButton.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 22),
      backButton.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -14),
      backButton.widthAnchor.constraint(equalToConstant: 30),
      backButton.heightAnchor.constraint(equalToConstant: 30),
      titleLabel.leadingAnchor.constraint(equalTo: backButton.trailingAnchor, constant: 10),
      titleLabel.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -20),
      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 12),
      subtitleLabel.lastBaselineAnchor.constraint(equalTo: titleLabel.lastBaselineAnchor),
      content.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 14),
      content.leadingAnchor.constraint(equalTo: background.leadingAnchor, constant: 22),
      content.trailingAnchor.constraint(equalTo: background.trailingAnchor, constant: -22),
      content.bottomAnchor.constraint(equalTo: statusPanel.topAnchor, constant: -10),
      statusPanel.leadingAnchor.constraint(equalTo: background.leadingAnchor, constant: 22),
      statusPanel.trailingAnchor.constraint(equalTo: background.trailingAnchor, constant: -22),
      statusPanel.bottomAnchor.constraint(equalTo: background.bottomAnchor, constant: -12),
      statusPanel.heightAnchor.constraint(equalToConstant: 32),
      spinner.leadingAnchor.constraint(equalTo: statusPanel.leadingAnchor, constant: 12),
      spinner.centerYAnchor.constraint(equalTo: statusPanel.centerYAnchor),
      statusLabel.leadingAnchor.constraint(equalTo: spinner.trailingAnchor, constant: 9),
      statusLabel.trailingAnchor.constraint(equalTo: statusPanel.trailingAnchor, constant: -12),
      statusLabel.centerYAnchor.constraint(equalTo: statusPanel.centerYAnchor),
    ])
  }

  private func clearContent() {
    content.subviews.forEach { $0.removeFromSuperview() }
    searchField = nil
    environmentTable = nil
    randomTable = nil
    randomIntervalPopup = nil
    backgroundModePopup = nil
    backgroundIntervalPopup = nil
    soundtrackModePopup = nil
    trackChangeModePopup = nil
  }

  @objc private func goHome() {
    guard !process.isRunning else { return }
    showHome()
  }

  private func showHome() {
    currentPage = "home"
    clearContent()
    backButton.isHidden = true
    titleLabel.stringValue = "Codex 皮肤控制台"
    subtitleLabel.stringValue = snapshot.map { "当前：\($0.activeTheme.name)" } ?? "Terraria × Codex"

    let intro = NSTextField(labelWithString: "环境 / 音乐 / 随机轮换")
    intro.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
    intro.textColor = Palette.muted
    intro.maximumNumberOfLines = 1
    intro.lineBreakMode = .byTruncatingTail
    intro.translatesAutoresizingMaskIntoConstraints = false
    let homeBody = NSView()
    homeBody.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(homeBody)
    homeBody.addSubview(intro)

    let environment = DashboardCard(
      title: "选择环境",
      subtitle: "44 套环境 · 随机主题 · 恢复原版",
      resource: "EnvironmentCard"
    )
    environment.target = self
    environment.action = #selector(showEnvironmentPage)
    let music = DashboardCard(
      title: "音乐配置",
      subtitle: "本地曲库 · 播放规则 · 音量",
      resource: "MusicCard"
    )
    music.target = self
    music.action = #selector(showMusicPage)
    let random = DashboardCard(
      title: "全随机环境配置",
      subtitle: "参与环境 · 切换间隔 · 多背景",
      resource: "RandomCard"
    )
    random.target = self
    random.action = #selector(showRandomPage)

    let cards = NSStackView(views: [environment, music, random])
    cards.orientation = .horizontal
    cards.distribution = .fillEqually
    cards.spacing = 10
    cards.translatesAutoresizingMaskIntoConstraints = false
    homeBody.addSubview(cards)

    let worldPanel = makePanel()
    let guidePanel = makePanel()
    worldPanel.translatesAutoresizingMaskIntoConstraints = false
    guidePanel.translatesAutoresizingMaskIntoConstraints = false
    homeBody.addSubview(worldPanel)
    homeBody.addSubview(guidePanel)

    let worldIcon = pixelResourceView("EnvironmentCard")
    worldIcon.translatesAutoresizingMaskIntoConstraints = false
    worldPanel.addSubview(worldIcon)
    let worldKicker = homeKicker("当前配置")
    worldPanel.addSubview(worldKicker)
    let worldName = NSTextField(labelWithString: snapshot?.activeTheme.name ?? "正在读取世界状态…")
    worldName.font = .systemFont(ofSize: 17, weight: .bold)
    worldName.textColor = Palette.ink
    worldName.lineBreakMode = .byTruncatingTail
    worldName.translatesAutoresizingMaskIntoConstraints = false
    worldPanel.addSubview(worldName)
    let musicMode = snapshot.map {
      $0.music.enabled
        ? "\($0.music.soundtrackMode == "otherworld" ? "来世" : ($0.music.soundtrackMode == "mixed" ? "混合" : "经典"))原声 · \($0.music.volume)% · \($0.music.trackChangeMode == "fixed" ? "单曲循环" : ($0.music.playbackMode == "random" ? "随机播放" : "顺序播放"))"
        : "环境音乐未开启"
    } ?? "正在读取音乐状态…"
    let worldDetail = NSTextField(labelWithString: musicMode)
    worldDetail.font = .systemFont(ofSize: 11, weight: .medium)
    worldDetail.textColor = Palette.muted
    worldDetail.lineBreakMode = .byTruncatingTail
    worldDetail.translatesAutoresizingMaskIntoConstraints = false
    worldPanel.addSubview(worldDetail)

    let environmentMetric = makeMetricTile(
      title: "环境图鉴",
      value: "\(snapshot?.environments.count ?? 44) 套",
      resource: "EnvironmentCard"
    )
    let randomMetric = makeMetricTile(
      title: "随机轮换",
      value: snapshot.map {
        "\($0.random.enabledCount) / \($0.random.total) · \($0.random.environmentIntervalMinutes ?? 10) 分"
      } ?? "— / 44",
      resource: "RandomCard"
    )
    let musicMetric = makeMetricTile(
      title: "本地音乐",
      value: snapshot.map { "\($0.music.importedTotal) 首" } ?? "读取中",
      resource: "MusicCard"
    )
    let metrics = NSStackView(views: [environmentMetric, randomMetric, musicMetric])
    metrics.orientation = .horizontal
    metrics.distribution = .fillEqually
    metrics.spacing = 10
    metrics.translatesAutoresizingMaskIntoConstraints = false
    worldPanel.addSubview(metrics)

    let guideTitle = homeKicker("使用说明")
    guidePanel.addSubview(guideTitle)
    let guideRows = NSStackView(views: [
      makeHomeGuideRow(resource: "EnvironmentCard", text: "环境可直接热切换"),
      makeHomeGuideRow(resource: "MusicCard", text: "播放按钮位于 Codex 顶部"),
      makeHomeGuideRow(resource: "MagicMirror", text: "环境页可恢复官方外观"),
    ])
    guideRows.orientation = .vertical
    guideRows.alignment = .leading
    guideRows.spacing = 12
    guideRows.translatesAutoresizingMaskIntoConstraints = false
    guidePanel.addSubview(guideRows)
    let ready = NSTextField(labelWithString: "配置保存在本机")
    ready.font = .monospacedSystemFont(ofSize: 10, weight: .bold)
    ready.textColor = Palette.gold
    ready.translatesAutoresizingMaskIntoConstraints = false
    guidePanel.addSubview(ready)
    let readyLine = NSView()
    readyLine.wantsLayer = true
    readyLine.layer?.backgroundColor = Palette.gold.withAlphaComponent(0.65).cgColor
    readyLine.layer?.cornerRadius = 2
    readyLine.translatesAutoresizingMaskIntoConstraints = false
    guidePanel.addSubview(readyLine)

    NSLayoutConstraint.activate([
      homeBody.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      homeBody.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      homeBody.centerYAnchor.constraint(equalTo: content.centerYAnchor, constant: 12),
      homeBody.topAnchor.constraint(greaterThanOrEqualTo: content.topAnchor, constant: 8),
      homeBody.bottomAnchor.constraint(lessThanOrEqualTo: content.bottomAnchor, constant: -8),
      intro.topAnchor.constraint(equalTo: homeBody.topAnchor),
      intro.leadingAnchor.constraint(equalTo: homeBody.leadingAnchor, constant: 2),
      intro.trailingAnchor.constraint(equalTo: homeBody.trailingAnchor, constant: -2),
      cards.topAnchor.constraint(equalTo: intro.bottomAnchor, constant: 9),
      cards.leadingAnchor.constraint(equalTo: homeBody.leadingAnchor),
      cards.trailingAnchor.constraint(equalTo: homeBody.trailingAnchor),
      cards.heightAnchor.constraint(equalToConstant: 118),
      worldPanel.topAnchor.constraint(equalTo: cards.bottomAnchor, constant: 10),
      worldPanel.leadingAnchor.constraint(equalTo: homeBody.leadingAnchor),
      worldPanel.heightAnchor.constraint(equalToConstant: 178),
      worldPanel.widthAnchor.constraint(equalTo: homeBody.widthAnchor, multiplier: 0.64, constant: -7),
      guidePanel.topAnchor.constraint(equalTo: worldPanel.topAnchor),
      guidePanel.trailingAnchor.constraint(equalTo: homeBody.trailingAnchor),
      guidePanel.heightAnchor.constraint(equalTo: worldPanel.heightAnchor),
      guidePanel.leadingAnchor.constraint(equalTo: worldPanel.trailingAnchor, constant: 10),
      guidePanel.bottomAnchor.constraint(equalTo: homeBody.bottomAnchor),
      worldIcon.leadingAnchor.constraint(equalTo: worldPanel.leadingAnchor, constant: 16),
      worldIcon.topAnchor.constraint(equalTo: worldPanel.topAnchor, constant: 15),
      worldIcon.widthAnchor.constraint(equalToConstant: 22),
      worldIcon.heightAnchor.constraint(equalToConstant: 22),
      worldKicker.leadingAnchor.constraint(equalTo: worldIcon.trailingAnchor, constant: 8),
      worldKicker.centerYAnchor.constraint(equalTo: worldIcon.centerYAnchor),
      worldName.leadingAnchor.constraint(equalTo: worldPanel.leadingAnchor, constant: 16),
      worldName.trailingAnchor.constraint(equalTo: worldPanel.trailingAnchor, constant: -16),
      worldName.topAnchor.constraint(equalTo: worldIcon.bottomAnchor, constant: 6),
      worldDetail.leadingAnchor.constraint(equalTo: worldName.leadingAnchor),
      worldDetail.trailingAnchor.constraint(equalTo: worldName.trailingAnchor),
      worldDetail.topAnchor.constraint(equalTo: worldName.bottomAnchor, constant: 5),
      metrics.leadingAnchor.constraint(equalTo: worldPanel.leadingAnchor, constant: 14),
      metrics.trailingAnchor.constraint(equalTo: worldPanel.trailingAnchor, constant: -14),
      metrics.bottomAnchor.constraint(equalTo: worldPanel.bottomAnchor, constant: -12),
      metrics.heightAnchor.constraint(equalToConstant: 60),
      guideTitle.topAnchor.constraint(equalTo: guidePanel.topAnchor, constant: 15),
      guideTitle.leadingAnchor.constraint(equalTo: guidePanel.leadingAnchor, constant: 16),
      guideRows.topAnchor.constraint(equalTo: guideTitle.bottomAnchor, constant: 12),
      guideRows.leadingAnchor.constraint(equalTo: guidePanel.leadingAnchor, constant: 16),
      guideRows.trailingAnchor.constraint(lessThanOrEqualTo: guidePanel.trailingAnchor, constant: -14),
      ready.leadingAnchor.constraint(equalTo: guidePanel.leadingAnchor, constant: 16),
      ready.bottomAnchor.constraint(equalTo: guidePanel.bottomAnchor, constant: -13),
      readyLine.leadingAnchor.constraint(equalTo: ready.trailingAnchor, constant: 10),
      readyLine.trailingAnchor.constraint(equalTo: guidePanel.trailingAnchor, constant: -16),
      readyLine.centerYAnchor.constraint(equalTo: ready.centerYAnchor),
      readyLine.heightAnchor.constraint(equalToConstant: 3),
    ])
  }

  @objc private func showEnvironmentPage() {
    currentPage = "environment"
    clearContent()
    backButton.isHidden = false
    titleLabel.stringValue = "选择环境"
    subtitleLabel.stringValue = "切换时显示实时进度，不阻塞界面"

    let search = NSSearchField()
    search.placeholderString = "搜索环境，例如：洞穴、夜晚、入侵"
    search.stringValue = environmentQuery
    search.delegate = self
    search.translatesAutoresizingMaskIntoConstraints = false
    searchField = search
    content.addSubview(search)

    let official = makeProminentActionButton(
      "恢复 Codex 官方原版",
      symbol: "arrow.uturn.backward.circle.fill",
      tint: Palette.cyan
    )
    official.target = self
    official.action = #selector(applyOfficial)
    let random = makeProminentActionButton(
      "应用全环境随机",
      symbol: "shuffle.circle.fill",
      tint: Palette.gold
    )
    random.target = self
    random.action = #selector(applyRandom)
    let actions = NSStackView(views: [official, random])
    actions.orientation = .horizontal
    actions.distribution = .fillEqually
    actions.spacing = 12
    actions.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(actions)

    let scroll = NSScrollView()
    scroll.drawsBackground = false
    scroll.hasVerticalScroller = true
    scroll.autohidesScrollers = true
    scroll.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(scroll)
    let table = makeTable(identifier: "environment-table")
    table.target = self
    table.action = #selector(environmentRowClicked)
    scroll.documentView = table
    environmentTable = table
    NSLayoutConstraint.activate([
      search.topAnchor.constraint(equalTo: content.topAnchor),
      search.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      search.widthAnchor.constraint(equalTo: content.widthAnchor, multiplier: 0.42),
      search.heightAnchor.constraint(equalToConstant: 44),
      actions.leadingAnchor.constraint(equalTo: search.trailingAnchor, constant: 14),
      actions.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      actions.centerYAnchor.constraint(equalTo: search.centerYAnchor),
      actions.heightAnchor.constraint(equalToConstant: 44),
      scroll.topAnchor.constraint(equalTo: search.bottomAnchor, constant: 16),
      scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: content.bottomAnchor),
    ])
    rebuildEnvironmentGrid()
  }

  func controlTextDidChange(_ obj: Notification) {
    guard let field = obj.object as? NSSearchField, field === searchField else { return }
    environmentQuery = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    rebuildEnvironmentGrid()
  }

  private func rebuildEnvironmentGrid() {
    filteredEnvironments = (snapshot?.environments ?? []).filter {
      environmentQuery.isEmpty
        || $0.name.localizedCaseInsensitiveContains(environmentQuery)
        || $0.variant.localizedCaseInsensitiveContains(environmentQuery)
    }
    environmentTable?.reloadData()
  }

  @objc private func applyOfficial() {
    runMutation(["apply", "official"], working: "正在安全恢复官方原版…", success: "已恢复 Codex 官方原版。")
  }

  @objc private func applyRandom() {
    runMutation(["apply", "random"], working: "正在应用全环境随机…", success: "已应用全环境随机。")
  }

  @objc private func environmentRowClicked(_ sender: NSTableView) {
    let row = sender.clickedRow >= 0 ? sender.clickedRow : sender.selectedRow
    guard row >= 0, row < filteredEnvironments.count else { return }
    let environment = filteredEnvironments[row]
    runMutation(
      ["apply", environment.variant],
      working: "正在切换到 \(environment.name)…",
      success: "环境已切换。"
    )
  }

  @objc private func showMusicPage() {
    currentPage = "music"
    clearContent()
    backButton.isHidden = false
    titleLabel.stringValue = "音乐配置"
    subtitleLabel.stringValue = "本地曲库，不随皮肤包附带"
    guard let music = snapshot?.music else {
      showLoadingPlaceholder()
      return
    }

    let left = makePanel()
    let right = makePanel()
    content.addSubview(left)
    content.addSubview(right)
    left.translatesAutoresizingMaskIntoConstraints = false
    right.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      left.topAnchor.constraint(equalTo: content.topAnchor),
      left.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      left.heightAnchor.constraint(equalToConstant: 380),
      left.widthAnchor.constraint(equalTo: content.widthAnchor, multiplier: 0.50, constant: -7),
      right.topAnchor.constraint(equalTo: content.topAnchor),
      right.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      right.heightAnchor.constraint(equalTo: left.heightAnchor),
      right.widthAnchor.constraint(equalTo: content.widthAnchor, multiplier: 0.50, constant: -7),
    ])

    let enabled = checkbox("启用环境音乐", state: music.enabled)
    enabledToggle = enabled
    let volume = NSSlider(value: Double(music.volume), minValue: 0, maxValue: 100, target: self, action: #selector(volumeChanged))
    volume.numberOfTickMarks = 11
    volume.allowsTickMarkValuesOnly = false
    volumeSlider = volume
    let volumeText = valueLabel("\(music.volume)%")
    volumeLabel = volumeText
    let playback = popup(["按导入顺序播放", "随机播放"], selected: music.playbackMode == "random" ? 1 : 0)
    playbackPopup = playback
    let soundtrack = popup(
      ["经典原声", "来世原声（缺曲回退经典）", "经典与来世混合"],
      selected: music.soundtrackMode == "otherworld" ? 1 : (music.soundtrackMode == "mixed" ? 2 : 0)
    )
    soundtrackModePopup = soundtrack
    let trackChange = popup(
      ["每首结束后继续切换", "进入环境后固定一首循环"],
      selected: music.trackChangeMode == "fixed" ? 1 : 0
    )
    trackChangeModePopup = trackChange
    let gap = popup((0...30).map { "\($0) 秒" }, selected: music.trackGapSeconds)
    gapPopup = gap
    let fades = stride(from: 0.0, through: 5.0, by: 0.5).map { String(format: "%.1f 秒", $0) }
    let fadeIndex = max(0, min(fades.count - 1, Int(round(music.fadeInSeconds * 2))))
    let fade = popup(fades, selected: fadeIndex)
    fadePopup = fade
    let hidden = checkbox("Codex 隐藏时暂停", state: music.pauseWhenHidden)
    hiddenToggle = hidden
    let environmentMode = popup(
      ["换环境时立即换曲", "播完当前曲再换"],
      selected: music.environmentChangeMode == "after-current" ? 1 : 0
    )
    environmentModePopup = environmentMode
    let save = makeActionButton("保存并应用音乐设置", symbol: "checkmark.circle.fill")
    save.contentTintColor = Palette.gold
    save.target = self
    save.action = #selector(saveMusic)

    let settingsStack = NSStackView()
    settingsStack.orientation = .vertical
    settingsStack.spacing = 9
    settingsStack.translatesAutoresizingMaskIntoConstraints = false
    left.addSubview(settingsStack)
    settingsStack.addArrangedSubview(sectionTitle("播放设置"))
    settingsStack.addArrangedSubview(enabled)
    settingsStack.addArrangedSubview(labeledRow("音量", controls: [volume, volumeText]))
    settingsStack.addArrangedSubview(labeledRow("原声版本", controls: [soundtrack]))
    settingsStack.addArrangedSubview(labeledRow("曲目顺序", controls: [playback]))
    settingsStack.addArrangedSubview(labeledRow("播放行为", controls: [trackChange]))
    settingsStack.addArrangedSubview(labeledRow("曲间等待", controls: [gap]))
    settingsStack.addArrangedSubview(labeledRow("渐入时长", controls: [fade]))
    settingsStack.addArrangedSubview(hidden)
    settingsStack.addArrangedSubview(labeledRow("环境切换", controls: [environmentMode]))
    settingsStack.addArrangedSubview(save)
    NSLayoutConstraint.activate([
      settingsStack.topAnchor.constraint(equalTo: left.topAnchor, constant: 22),
      settingsStack.leadingAnchor.constraint(equalTo: left.leadingAnchor, constant: 22),
      settingsStack.trailingAnchor.constraint(equalTo: left.trailingAnchor, constant: -22),
    ])

    let slot = NSPopUpButton()
    music.slots.forEach {
      let state = $0.imported > 0 ? "\($0.imported) 首" : "待导入"
      slot.addItem(withTitle: "\($0.name)（\(state)）")
    }
    slotPopup = slot
    let importButton = makeActionButton("导入本地音乐", symbol: "square.and.arrow.down")
    importButton.target = self
    importButton.action = #selector(importMusic)
    let libraryStack = NSStackView()
    libraryStack.orientation = .vertical
    libraryStack.spacing = 16
    libraryStack.translatesAutoresizingMaskIntoConstraints = false
    right.addSubview(libraryStack)
    libraryStack.addArrangedSubview(sectionTitle("本机音乐库"))
    let populatedSlots = music.slots.filter { $0.imported > 0 }.count
    if music.importedTotal == 0 {
      libraryStack.addArrangedSubview(valueLabel("尚未导入本地音乐"))
      libraryStack.addArrangedSubview(valueLabel(
        "这是正常状态：安装包不会附带或下载 Terraria 原声。请先选择环境，再导入你合法持有的本地音乐。"
      ))
    } else {
      libraryStack.addArrangedSubview(valueLabel(
        "已导入 \(music.importedTotal) 首 · \(populatedSlots) 个环境槽"
      ))
      libraryStack.addArrangedSubview(valueLabel(
        "选择音乐对应的环境。一个环境可导入多首，文件只复制到本机私有目录。"
      ))
    }
    libraryStack.addArrangedSubview(slot)
    libraryStack.addArrangedSubview(importButton)
    libraryStack.addArrangedSubview(valueLabel("首次播放仍需回到 Codex 点击顶部 ♪，之后切换环境会自动使用对应音乐池。"))
    NSLayoutConstraint.activate([
      libraryStack.topAnchor.constraint(equalTo: right.topAnchor, constant: 22),
      libraryStack.leadingAnchor.constraint(equalTo: right.leadingAnchor, constant: 22),
      libraryStack.trailingAnchor.constraint(equalTo: right.trailingAnchor, constant: -22),
    ])
  }

  @objc private func volumeChanged() {
    volumeLabel?.stringValue = "\(Int(volumeSlider?.doubleValue.rounded() ?? 0))%"
  }

  @objc private func saveMusic() {
    guard let enabledToggle, let volumeSlider, let playbackPopup, let gapPopup,
          let fadePopup, let hiddenToggle, let environmentModePopup,
          let soundtrackModePopup, let trackChangeModePopup else { return }
    let arguments = [
      "music-save",
      enabledToggle.state == .on ? "on" : "off",
      "\(Int(volumeSlider.doubleValue.rounded()))",
      playbackPopup.indexOfSelectedItem == 1 ? "random" : "sequential",
      "\(gapPopup.indexOfSelectedItem)",
      String(format: "%.1f", Double(fadePopup.indexOfSelectedItem) / 2.0),
      hiddenToggle.state == .on ? "on" : "off",
      environmentModePopup.indexOfSelectedItem == 1 ? "after-current" : "immediate",
      soundtrackModePopup.indexOfSelectedItem == 1
        ? "otherworld" : (soundtrackModePopup.indexOfSelectedItem == 2 ? "mixed" : "classic"),
      trackChangeModePopup.indexOfSelectedItem == 1 ? "fixed" : "rotate",
    ]
    runMutation(arguments, working: "正在保存并热更新音乐设置…", success: "音乐设置已保存并应用。")
  }

  @objc private func importMusic() {
    guard let music = snapshot?.music, let slotPopup,
          slotPopup.indexOfSelectedItem >= 0, slotPopup.indexOfSelectedItem < music.slots.count else { return }
    let panel = NSOpenPanel()
    panel.title = "选择本地音乐"
    panel.prompt = "导入"
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.allowedContentTypes = ["mp3", "m4a", "wav", "ogg", "flac"].compactMap {
      UTType(filenameExtension: $0)
    }
    panel.beginSheetModal(for: window) { [weak self] response in
      guard response == .OK, let url = panel.url else { return }
      let slot = music.slots[slotPopup.indexOfSelectedItem]
      self?.runMutation(
        ["music-import", slot.id, url.path],
        working: "正在校验并导入 \(url.lastPathComponent)…",
        success: "音乐已导入并启用。回到 Codex 点击顶部 ♪ 开始播放。"
      )
    }
  }

  @objc private func showRandomPage() {
    currentPage = "random"
    clearContent()
    backButton.isHidden = false
    titleLabel.stringValue = "全随机环境配置"
    subtitleLabel.stringValue = "关闭的环境不会参与轮换，至少保留 2 套"
    guard let snapshot else {
      showLoadingPlaceholder()
      return
    }

    let intervalPanel = makePanel()
    intervalPanel.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(intervalPanel)
    let intervalLabel = NSTextField(labelWithString: "环境切换间隔")
    intervalLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    intervalLabel.textColor = Palette.ink
    intervalLabel.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(intervalLabel)
    let intervalHint = NSTextField(labelWithString: "保存后长期有效；不会重新加载皮肤或中断正在播放的音乐")
    intervalHint.font = .systemFont(ofSize: 11, weight: .medium)
    intervalHint.textColor = Palette.muted
    intervalHint.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(intervalHint)
    let intervalPopup = NSPopUpButton()
    intervalPopup.addItems(withTitles: (1...60).map { "\($0) 分钟" })
    let savedMinutes = min(max(snapshot.random.environmentIntervalMinutes ?? 10, 1), 60)
    intervalPopup.selectItem(at: savedMinutes - 1)
    intervalPopup.font = .systemFont(ofSize: 12, weight: .semibold)
    intervalPopup.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(intervalPopup)
    randomIntervalPopup = intervalPopup
    let backgroundLabel = NSTextField(labelWithString: "同环境多背景")
    backgroundLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    backgroundLabel.textColor = Palette.ink
    backgroundLabel.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(backgroundLabel)
    let backgroundMode = popup(
      ["进入环境后固定一张", "停留期间定时轮换"],
      selected: snapshot.random.backgroundMode == "rotate" ? 1 : 0
    )
    backgroundMode.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(backgroundMode)
    backgroundModePopup = backgroundMode
    let backgroundInterval = popup(
      (1...60).map { "\($0) 分钟" },
      selected: min(max(snapshot.random.backgroundIntervalMinutes, 1), 60) - 1
    )
    backgroundInterval.translatesAutoresizingMaskIntoConstraints = false
    intervalPanel.addSubview(backgroundInterval)
    backgroundIntervalPopup = backgroundInterval

    let selectAll = makeActionButton("全选", symbol: "checkmark.square.fill")
    selectAll.target = self
    selectAll.action = #selector(includeAllRandom)
    let clear = makeActionButton("全部取消", symbol: "square")
    clear.target = self
    clear.action = #selector(excludeAllRandom)
    let next = makeActionButton("随机下一个", symbol: "shuffle.circle.fill")
    next.target = self
    next.action = #selector(nextRandomEnvironment)
    let save = makeActionButton("保存设置", symbol: "checkmark.circle.fill")
    save.contentTintColor = Palette.gold
    save.target = self
    save.action = #selector(saveRandom)
    let actions = NSStackView(views: [selectAll, clear, next, save])
    actions.orientation = .horizontal
    actions.distribution = .fillEqually
    actions.spacing = 12
    actions.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(actions)

    let scroll = NSScrollView()
    scroll.drawsBackground = false
    scroll.hasVerticalScroller = true
    scroll.autohidesScrollers = true
    scroll.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(scroll)
    randomIncluded = Set(snapshot.environments.filter(\.includedInRandom).map(\.variant))
    let table = makeTable(identifier: "random-table")
    scroll.documentView = table
    randomTable = table
    NSLayoutConstraint.activate([
      intervalPanel.topAnchor.constraint(equalTo: content.topAnchor),
      intervalPanel.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      intervalPanel.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      intervalPanel.heightAnchor.constraint(equalToConstant: 108),
      intervalLabel.leadingAnchor.constraint(equalTo: intervalPanel.leadingAnchor, constant: 16),
      intervalLabel.topAnchor.constraint(equalTo: intervalPanel.topAnchor, constant: 12),
      intervalHint.leadingAnchor.constraint(equalTo: intervalLabel.leadingAnchor),
      intervalHint.topAnchor.constraint(equalTo: intervalLabel.bottomAnchor, constant: 5),
      intervalPopup.trailingAnchor.constraint(equalTo: intervalPanel.trailingAnchor, constant: -14),
      intervalPopup.centerYAnchor.constraint(equalTo: intervalLabel.centerYAnchor),
      intervalPopup.widthAnchor.constraint(equalToConstant: 118),
      backgroundLabel.leadingAnchor.constraint(equalTo: intervalLabel.leadingAnchor),
      backgroundLabel.topAnchor.constraint(equalTo: intervalHint.bottomAnchor, constant: 13),
      backgroundMode.leadingAnchor.constraint(equalTo: backgroundLabel.trailingAnchor, constant: 16),
      backgroundMode.centerYAnchor.constraint(equalTo: backgroundLabel.centerYAnchor),
      backgroundMode.widthAnchor.constraint(equalToConstant: 172),
      backgroundInterval.trailingAnchor.constraint(equalTo: intervalPopup.trailingAnchor),
      backgroundInterval.centerYAnchor.constraint(equalTo: backgroundLabel.centerYAnchor),
      backgroundInterval.widthAnchor.constraint(equalToConstant: 118),
      actions.topAnchor.constraint(equalTo: intervalPanel.bottomAnchor, constant: 12),
      actions.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      actions.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      actions.heightAnchor.constraint(equalToConstant: 40),
      scroll.topAnchor.constraint(equalTo: actions.bottomAnchor, constant: 12),
      scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: content.bottomAnchor),
    ])
  }

  @objc private func includeAllRandom() {
    randomIncluded = Set(snapshot?.environments.map(\.variant) ?? [])
    randomTable?.reloadData()
  }

  @objc private func excludeAllRandom() {
    randomIncluded.removeAll()
    randomTable?.reloadData()
  }

  @objc private func nextRandomEnvironment() {
    runMutation(
      ["random-next"],
      working: "正在随机切换到下一个环境…",
      success: "已切换到下一个随机环境，音乐会继续按当前设置播放。"
    )
  }

  @objc private func saveRandom() {
    guard randomIncluded.count >= 2 else {
      showError("全环境随机至少需要保留 2 套环境。")
      return
    }
    let excluded = (snapshot?.environments ?? [])
      .map(\.variant)
      .filter { !randomIncluded.contains($0) }
      .sorted()
    let minutes = (randomIntervalPopup?.indexOfSelectedItem ?? 9) + 1
    let backgroundMode = backgroundModePopup?.indexOfSelectedItem == 1 ? "rotate" : "fixed"
    let backgroundMinutes = (backgroundIntervalPopup?.indexOfSelectedItem ?? 14) + 1
    runMutation(
      ["random-save", "\(minutes)", backgroundMode, "\(backgroundMinutes)"] + excluded,
      working: "正在保存环境、背景与切换间隔…",
      success: "设置已保存；除非当前环境已被取消，否则环境与正在播放的音乐保持不变。"
    )
  }

  func numberOfRows(in tableView: NSTableView) -> Int {
    if tableView.identifier?.rawValue == "environment-table" {
      return filteredEnvironments.count
    }
    return snapshot?.environments.count ?? 0
  }

  func tableView(
    _ tableView: NSTableView,
    viewFor tableColumn: NSTableColumn?,
    row: Int
  ) -> NSView? {
    if tableView.identifier?.rawValue == "environment-table" {
      guard row < filteredEnvironments.count else { return nil }
      let environment = filteredEnvironments[row]
      let cell = NSTableCellView()
      let icon = NSImageView(image: NSImage(
        systemSymbolName: biomeSymbol(environment.variant),
        accessibilityDescription: nil
      ) ?? NSImage())
      icon.contentTintColor = Palette.cyan
      icon.translatesAutoresizingMaskIntoConstraints = false
      cell.addSubview(icon)
      let active = snapshot?.activeTheme.variant == environment.variant
      let label = NSTextField(labelWithString: active ? "✓ \(environment.name)" : environment.name)
      label.font = .systemFont(ofSize: 14, weight: active ? .bold : .medium)
      label.textColor = active ? Palette.gold : Palette.ink
      label.translatesAutoresizingMaskIntoConstraints = false
      cell.addSubview(label)
      NSLayoutConstraint.activate([
        icon.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 12),
        icon.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        icon.widthAnchor.constraint(equalToConstant: 19),
        icon.heightAnchor.constraint(equalToConstant: 19),
        label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 10),
        label.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -10),
        label.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
      ])
      return cell
    }

    guard let environments = snapshot?.environments, row < environments.count else { return nil }
    let environment = environments[row]
    let check = checkbox(
      environment.name.replacingOccurrences(of: "Terraria · ", with: ""),
      state: randomIncluded.contains(environment.variant)
    )
    check.identifier = NSUserInterfaceItemIdentifier(environment.variant)
    check.target = self
    check.action = #selector(randomCheckboxChanged(_:))
    return check
  }

  @objc private func randomCheckboxChanged(_ sender: NSButton) {
    guard let variant = sender.identifier?.rawValue else { return }
    if sender.state == .on {
      randomIncluded.insert(variant)
    } else {
      randomIncluded.remove(variant)
    }
  }

  private func loadSnapshot(showBusy: Bool = true) {
    if showBusy { setBusy(true, message: "正在读取本机配置…") }
    process.run(arguments: ["snapshot"]) { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(let data):
        do {
          self.snapshot = try self.decoder.decode(ControlSnapshot.self, from: data)
          self.setBusy(false, message: "就绪 · 当前：\(self.snapshot!.activeTheme.name)")
          self.refreshCurrentPage()
        } catch {
          self.setBusy(false, message: "配置读取失败")
          self.showError("无法解析本机皮肤配置：\(error.localizedDescription)")
        }
      case .failure(let error):
        self.setBusy(false, message: "皮肤引擎不可用")
        self.showError(error.localizedDescription)
      }
    }
  }

  private func runMutation(_ arguments: [String], working: String, success: String) {
    setBusy(true, message: working)
    process.run(arguments: arguments) { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(let data):
        if let updated = try? self.decoder.decode(ControlSnapshot.self, from: data) {
          self.snapshot = updated
          self.setBusy(false, message: success)
          self.refreshCurrentPage()
        } else {
          self.setBusy(false, message: success)
          self.loadSnapshot(showBusy: false)
        }
      case .failure(let error):
        self.setBusy(false, message: "操作未完成")
        self.showError(error.localizedDescription)
      }
    }
  }

  private func refreshCurrentPage() {
    switch currentPage {
    case "environment": showEnvironmentPage()
    case "music": showMusicPage()
    case "random": showRandomPage()
    default: showHome()
    }
  }

  private func setBusy(_ busy: Bool, message: String) {
    statusLabel.stringValue = message
    busy ? spinner.startAnimation(nil) : spinner.stopAnimation(nil)
    setControls(in: content, enabled: !busy)
    backButton.isEnabled = !busy
  }

  private func setControls(in view: NSView, enabled: Bool) {
    if let control = view as? NSControl {
      control.isEnabled = enabled
    }
    view.subviews.forEach { setControls(in: $0, enabled: enabled) }
  }

  private func showError(_ message: String) {
    let alert = NSAlert()
    alert.alertStyle = .warning
    alert.messageText = "Codex 皮肤控制台"
    alert.informativeText = message
    alert.addButton(withTitle: "好")
    alert.beginSheetModal(for: window)
  }

  private func showLoadingPlaceholder() {
    let label = NSTextField(labelWithString: "正在载入配置…")
    label.font = .systemFont(ofSize: 16, weight: .medium)
    label.textColor = Palette.muted
    label.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: content.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: content.centerYAnchor),
    ])
  }

  private func makeActionButton(_ title: String, symbol: String) -> NSButton {
    let image = NSImage(systemSymbolName: symbol, accessibilityDescription: title)
    let button = NSButton(title: title, image: image ?? NSImage(), target: nil, action: nil)
    button.imagePosition = .imageLeading
    button.bezelStyle = .texturedSquare
    button.font = .systemFont(ofSize: 13, weight: .semibold)
    button.contentTintColor = Palette.ink
    button.wantsLayer = true
    button.layer?.cornerRadius = 3
    button.layer?.borderColor = Palette.border.withAlphaComponent(0.75).cgColor
    button.layer?.borderWidth = 1
    return button
  }

  private func makeProminentActionButton(
    _ title: String,
    symbol: String,
    tint: NSColor
  ) -> NSButton {
    let image = NSImage(systemSymbolName: symbol, accessibilityDescription: title)
    let button = NSButton(title: title, image: image ?? NSImage(), target: nil, action: nil)
    button.imagePosition = .imageLeading
    button.isBordered = false
    button.font = .systemFont(ofSize: 13, weight: .heavy)
    button.contentTintColor = NSColor(calibratedWhite: 0.05, alpha: 1)
    button.attributedTitle = NSAttributedString(
      string: title,
      attributes: [
        .foregroundColor: NSColor(calibratedWhite: 0.05, alpha: 1),
        .font: NSFont.systemFont(ofSize: 13, weight: .heavy),
      ]
    )
    button.wantsLayer = true
    button.layer?.cornerRadius = 4
    button.layer?.backgroundColor = tint.withAlphaComponent(0.92).cgColor
    button.layer?.borderColor = tint.blended(
      withFraction: 0.35,
      of: NSColor.white
    )?.cgColor
    button.layer?.borderWidth = 1.5
    return button
  }

  private func makePanel() -> NSView {
    PixelPanelView()
  }

  private func homeKicker(_ text: String) -> NSTextField {
    let label = NSTextField(labelWithString: text)
    label.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
    label.textColor = Palette.cyan
    label.translatesAutoresizingMaskIntoConstraints = false
    return label
  }

  private func makeMetricTile(
    title: String,
    value: String,
    resource: String
  ) -> NSView {
    let tile = NSView()
    tile.wantsLayer = true
    tile.layer?.backgroundColor = Palette.groove.withAlphaComponent(0.70).cgColor
    tile.layer?.borderColor = Palette.border.withAlphaComponent(0.58).cgColor
    tile.layer?.borderWidth = 1
    tile.layer?.cornerRadius = 2
    let icon = pixelResourceView(resource)
    tile.addSubview(icon)
    let valueLabel = NSTextField(labelWithString: value)
    valueLabel.font = .monospacedDigitSystemFont(ofSize: 14, weight: .bold)
    valueLabel.textColor = Palette.ink
    valueLabel.translatesAutoresizingMaskIntoConstraints = false
    tile.addSubview(valueLabel)
    let titleLabel = NSTextField(labelWithString: title)
    titleLabel.font = .systemFont(ofSize: 10, weight: .medium)
    titleLabel.textColor = Palette.muted
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    tile.addSubview(titleLabel)
    NSLayoutConstraint.activate([
      icon.leadingAnchor.constraint(equalTo: tile.leadingAnchor, constant: 10),
      icon.centerYAnchor.constraint(equalTo: tile.centerYAnchor),
      icon.widthAnchor.constraint(equalToConstant: 18),
      icon.heightAnchor.constraint(equalToConstant: 18),
      valueLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
      valueLabel.trailingAnchor.constraint(lessThanOrEqualTo: tile.trailingAnchor, constant: -8),
      valueLabel.topAnchor.constraint(equalTo: tile.topAnchor, constant: 10),
      titleLabel.leadingAnchor.constraint(equalTo: valueLabel.leadingAnchor),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: tile.trailingAnchor, constant: -8),
      titleLabel.topAnchor.constraint(equalTo: valueLabel.bottomAnchor, constant: 3),
    ])
    return tile
  }

  private func makeHomeGuideRow(resource: String, text: String) -> NSView {
    let icon = pixelResourceView(resource)
    let label = NSTextField(labelWithString: text)
    label.font = .systemFont(ofSize: 11, weight: .medium)
    label.textColor = Palette.ink
    label.lineBreakMode = .byTruncatingTail
    let row = NSStackView(views: [icon, label])
    row.orientation = .horizontal
    row.alignment = .centerY
    row.spacing = 9
    NSLayoutConstraint.activate([
      icon.widthAnchor.constraint(equalToConstant: 16),
      icon.heightAnchor.constraint(equalToConstant: 16),
    ])
    return row
  }

  private func pixelResourceView(_ resource: String) -> NSImageView {
    let icon = NSImageView(image: NSImage(named: resource) ?? NSImage())
    icon.imageScaling = .scaleProportionallyUpOrDown
    icon.wantsLayer = true
    icon.layer?.magnificationFilter = .nearest
    icon.layer?.minificationFilter = .nearest
    icon.translatesAutoresizingMaskIntoConstraints = false
    return icon
  }

  private func makeTable(identifier: String) -> NSTableView {
    let table = NSTableView()
    table.identifier = NSUserInterfaceItemIdentifier(identifier)
    table.headerView = nil
    table.backgroundColor = .clear
    table.rowHeight = 34
    table.intercellSpacing = NSSize(width: 0, height: 2)
    table.selectionHighlightStyle = identifier == "environment-table" ? .regular : .none
    table.usesAlternatingRowBackgroundColors = false
    table.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
    let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("\(identifier)-main"))
    column.resizingMask = .autoresizingMask
    table.addTableColumn(column)
    table.dataSource = self
    table.delegate = self
    return table
  }

  private func checkbox(_ title: String, state: Bool) -> NSButton {
    let button = NSButton(checkboxWithTitle: title, target: nil, action: nil)
    button.state = state ? .on : .off
    button.font = .systemFont(ofSize: 13, weight: .medium)
    button.contentTintColor = Palette.cyan
    return button
  }

  private func popup(_ items: [String], selected: Int) -> NSPopUpButton {
    let popup = NSPopUpButton()
    popup.addItems(withTitles: items)
    popup.selectItem(at: max(0, min(items.count - 1, selected)))
    return popup
  }

  private func sectionTitle(_ text: String) -> NSTextField {
    let label = NSTextField(labelWithString: text)
    label.font = .monospacedSystemFont(ofSize: 15, weight: .bold)
    label.textColor = Palette.ink
    return label
  }

  private func valueLabel(_ text: String) -> NSTextField {
    let label = NSTextField(wrappingLabelWithString: text)
    label.font = .systemFont(ofSize: 12, weight: .medium)
    label.textColor = Palette.muted
    label.maximumNumberOfLines = 3
    return label
  }

  private func labeledRow(_ title: String, controls: [NSView]) -> NSView {
    let label = NSTextField(labelWithString: title)
    label.font = .systemFont(ofSize: 13, weight: .medium)
    label.textColor = Palette.ink
    let spacer = NSView()
    let row = NSStackView(views: [label, spacer] + controls)
    row.orientation = .horizontal
    row.spacing = 8
    row.setHuggingPriority(.defaultLow, for: .horizontal)
    spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
    return row
  }

  private func biomeSymbol(_ variant: String) -> String {
    if variant.contains("night") || variant.contains("moon") { return "moon.stars.fill" }
    if variant.contains("underground") || variant.contains("cavern") { return "mountain.2.fill" }
    if variant.contains("ocean") { return "water.waves" }
    if variant.contains("invasion") { return "flag.2.crossed.fill" }
    if variant.contains("lunar") || variant == "space" { return "sparkles" }
    if variant.contains("desert") { return "sun.max.fill" }
    if variant.contains("tundra") || variant.contains("ice") || variant.contains("frost") {
      return "snowflake"
    }
    if variant.contains("jungle") || variant.contains("forest") { return "leaf.fill" }
    return "circle.hexagongrid.fill"
  }
}

private let application = NSApplication.shared
private let delegate = AppDelegate()
application.delegate = delegate
application.run()
