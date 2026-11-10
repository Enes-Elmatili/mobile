// modules/fixed-hinge/ios/FixedHingeModule.swift
// La charnière de l'iPhone Duo, lue avec les API d'iOS 27.1 :
//   - posture   : UIHingeInteraction → UIHinge.status (fermé, entrouvert, à plat)
//   - angle     : UIHinge.angle (radians → degrés), pour les effets seulement
//   - pli       : reservedRegions(kind: .division) — où le pli coupe la fenêtre
// Grammaire Apple : la posture et le pli décident de la disposition, l'angle ne
// sert qu'aux effets. Ce module ne fait que LIRE : aucun réglage, aucun réseau.
// Compile avec le SDK iOS 27.1 (Xcode 27.1+) ; à l'exécution, rien avant 27.1.
import ExpoModulesCore
import UIKit

private let changeEvent = "onChange"
private let angleEvent = "onAngle"

public class FixedHingeModule: Module {
  private let lock = NSLock()
  private var state: [String: Any]?
  private var angleDegrees: Double?

  @MainActor private var observer: HingeObserverView?
  @MainActor private var keyObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("FixedHinge")

    Events(changeEvent, angleEvent)

    Function("getState") { () -> [String: Any]? in
      self.locked { self.state }
    }

    Function("getAngle") { () -> Double? in
      self.locked { self.angleDegrees }
    }

    // Diagnostic (éteint par défaut) : le JS journalise aussi ses mesures de mise en page.
    Function("isLogging") { () -> Bool in
      UserDefaults.standard.bool(forKey: "FixedHingeLog")
    }

    // Diagnostic : image de la fenêtre à la demande du JS (écran, sheet ou modale
    // qui s'ouvre). Ne fait rien sans le drapeau FixedHingeLog.
    Function("snapshot") { (name: String) in
      guard UserDefaults.standard.bool(forKey: "FixedHingeLog") else { return }
      DispatchQueue.main.async { MainActor.assumeIsolated { writeWindowSnapshot(name) } }
    }

    OnCreate {
      DispatchQueue.main.async { MainActor.assumeIsolated { self.attach() } }
      // Diagnostic (éteint par défaut) : une notification Darwin écrit une image
      // de la fenêtre — les captures du simulateur Duo sortent noires (Xcode 27.2).
      // xcrun simctl spawn <udid> notifyutil -p app.thefixed.snapshot
      if UserDefaults.standard.bool(forKey: "FixedHingeLog") {
        CFNotificationCenterAddObserver(
          CFNotificationCenterGetDarwinNotifyCenter(), nil,
          { _, _, _, _, _ in DispatchQueue.main.async { MainActor.assumeIsolated { writeWindowSnapshot(nil) } } },
          "app.thefixed.snapshot" as CFString, nil, .deliverImmediately
        )
      }
    }

    // La fenêtre n'existe pas toujours à la création du module.
    OnAppBecomesActive {
      DispatchQueue.main.async { MainActor.assumeIsolated { self.attach() } }
    }

    // Plier / déplier peut confier la scène à une autre fenêtre clé : on suit.
    OnStartObserving(changeEvent) {
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          guard self.keyObserver == nil else { return }
          self.keyObserver = NotificationCenter.default.addObserver(
            forName: UIWindow.didBecomeKeyNotification, object: nil, queue: .main
          ) { [weak self] _ in
            MainActor.assumeIsolated { self?.attach() }
          }
          self.attach()
        }
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          self.observer?.removeFromSuperview()
          self.observer = nil
          if let keyObserver = self.keyObserver { NotificationCenter.default.removeObserver(keyObserver) }
          self.keyObserver = nil
        }
      }
    }
  }

  private func locked<T>(_ body: () -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body()
  }

  @MainActor
  private func attach() {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
    guard let window else { return }
    if let observer, observer.window === window { return }
    observer?.removeFromSuperview()

    let view = HingeObserverView(frame: window.bounds)
    view.onState = { [weak self] next in
      guard let self else { return }
      let changed = self.locked { () -> Bool in
        let same: Bool
        switch (self.state, next) {
        case (nil, nil): same = true
        case let (a?, b?): same = NSDictionary(dictionary: a).isEqual(to: b)
        default: same = false
        }
        if same { return false }
        self.state = next
        if next == nil { self.angleDegrees = nil }
        return true
      }
      if changed { self.sendEvent(changeEvent, ["state": next as Any]) }
    }
    view.onAngle = { [weak self] degrees in
      guard let self else { return }
      self.locked { self.angleDegrees = degrees }
      self.sendEvent(angleEvent, ["degrees": degrees])
    }
    window.insertSubview(view, at: 0)
    observer = view
  }
}

/// Vue invisible à la taille de la fenêtre : UIKit ne livre la charnière et les
/// régions réservées qu'aux vues présentes dans une fenêtre. Les régions n'ont
/// pas de notification propre : on les relit à chaque mise à jour et à chaque
/// passe de layout (rotation, redimensionnement).
final class HingeObserverView: UIView {
  var onState: (([String: Any]?) -> Void)?
  var onAngle: ((Double) -> Void)?

  private var posture: String?
  private var lastAngle: Double?

  override init(frame: CGRect) {
    super.init(frame: frame)
    autoresizingMask = [.flexibleWidth, .flexibleHeight]
    isUserInteractionEnabled = false
    backgroundColor = .clear
    if #available(iOS 27.1, *) {
      addInteraction(UIHingeInteraction { [weak self] _, update in
        self?.hingeDidUpdate(update.hinge)
      })
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) non pris en charge") }

  override func layoutSubviews() {
    super.layoutSubviews()
    publish()
  }

  // Plier / déplier déplace la fenêtre d'un écran à l'autre et la redimensionne.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if let window { frame = window.bounds }
    publish()
  }

  /// Apple ne documente aucune notification quand les régions réservées
  /// changent : après une mise à jour de charnière, on relit à la passe de
  /// layout ET une fois la transition posée (runloop suivant), sinon la région
  /// lue en plein pliage peut rester la dernière publiée.
  private func publishSoon() {
    setNeedsLayout()
    DispatchQueue.main.async { [weak self] in MainActor.assumeIsolated { self?.publish() } }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in MainActor.assumeIsolated { self?.publish() } }
  }

  @available(iOS 27.1, *)
  private func hingeDidUpdate(_ hinge: UIHinge?) {
    guard let hinge else {
      posture = nil
      lastAngle = nil
      publish()
      publishSoon()
      return
    }
    let next: String
    switch hinge.status {
    case .closed: next = "closed"
    case .partiallyOpen: next = "partially-open"
    case .fullyOpen: next = "fully-open"
    default: next = "unknown"
    }
    if next != posture {
      posture = next
      publish()
      publishSoon()
    }
    // Un degré suffit aux effets ; inutile d'inonder le pont JS.
    let degrees = (Double(hinge.angle) * 180 / .pi).rounded()
    if degrees != lastAngle {
      lastAngle = degrees
      onAngle?(degrees)
    }
  }

  private func publish() {
    guard let posture else {
      onState?(nil)
      return
    }
    var payload: [String: Any] = ["posture": posture]
    if let window {
      // La taille de fenêtre de CETTE mesure : côté JS, un pli lu pour une autre
      // fenêtre (pendant un pliage) est reconnu périmé.
      payload["window"] = ["width": window.bounds.width, "height": window.bounds.height]
    }
    if #available(iOS 27.1, *), let window,
       let region = reservedRegions(kind: .division, options: .includeInactive).first {
      // Repère fenêtre. Apple : à plat la région est inactive et de largeur
      // nulle ; seule sa position compte (la largeur du pli est posée en JS).
      let frame = convert(region.frame, to: window)
      payload["fold"] = [
        "x": frame.origin.x,
        "y": frame.origin.y,
        "width": frame.width,
        "height": frame.height,
        "separating": region.isActive,
      ]
    }
    // Diagnostic, éteint par défaut (aucun coût en production) :
    // xcrun simctl spawn <udid> defaults write app.thefixed.client FixedHingeLog -bool YES
    if UserDefaults.standard.bool(forKey: "FixedHingeLog") {
      NSLog("[FixedHinge] %@", payload.description)
    }
    onState?(payload)
  }
}

/// Diagnostic : la fenêtre clé (modales présentées comprises) en PNG, dans le
/// dossier temporaire de l'app. N'existe que derrière le drapeau FixedHingeLog.
@MainActor
private func writeWindowSnapshot(_ name: String?) {
  guard let window = UIApplication.shared.connectedScenes
    .compactMap({ $0 as? UIWindowScene })
    .flatMap(\.windows)
    .first(where: \.isKeyWindow) else { return }
  let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
    _ = window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
  }
  let file = name.map { "duo-\($0)-\(Int(Date().timeIntervalSince1970 * 1000)).png" } ?? "duo-snapshot.png"
  let url = FileManager.default.temporaryDirectory.appendingPathComponent(file)
  try? image.pngData()?.write(to: url)
  NSLog("[FixedHinge] snapshot %@ %@", url.path, NSCoder.string(for: window.bounds))
}
