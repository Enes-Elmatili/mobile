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

  public func definition() -> ModuleDefinition {
    Name("FixedHinge")

    Events(changeEvent, angleEvent)

    Function("getState") { () -> [String: Any]? in
      self.locked { self.state }
    }

    Function("getAngle") { () -> Double? in
      self.locked { self.angleDegrees }
    }

    OnCreate {
      DispatchQueue.main.async { MainActor.assumeIsolated { self.attach() } }
    }

    // La fenêtre n'existe pas toujours à la création du module.
    OnAppBecomesActive {
      DispatchQueue.main.async { MainActor.assumeIsolated { self.attach() } }
    }

    OnDestroy {
      DispatchQueue.main.async {
        MainActor.assumeIsolated {
          self.observer?.removeFromSuperview()
          self.observer = nil
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

  @available(iOS 27.1, *)
  private func hingeDidUpdate(_ hinge: UIHinge?) {
    guard let hinge else {
      posture = nil
      lastAngle = nil
      publish()
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
      setNeedsLayout()
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
    if #available(iOS 27.1, *), let window,
       let region = reservedRegions(kind: .division, options: .includeInactive).first {
      // Repère fenêtre ; sur Duo la région fait ~40 pt, centrée sur le pli.
      let frame = convert(region.frame, to: window)
      payload["fold"] = [
        "x": frame.origin.x,
        "y": frame.origin.y,
        "width": frame.width,
        "height": frame.height,
        "separating": region.isActive,
      ]
    }
    onState?(payload)
  }
}
