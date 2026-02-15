## 🎯 Flow final
```
CLIENT                          PROVIDER
  |                                |
  | Crée + Paie                    |
  |-------------------------------->
  |                                | Reçoit carte
  |                                | Accepte
  |<--------------------------------
  | Alert + Tracking               | Alert + Ongoing
  |                                |
📍 TRACKING                     📍 ONGOING
  | Voit provider arriver           | Google Directions API
  | ETA: "12 min" → "10 min"        | Distance: "5.2 km"
  |<------- GPS toutes 10 sec ------| Temps: "12 min"
  |                                |
  |                                | Termine mission
  |<--------------------------------
  |                                |
⭐ RATING                      💰 EARNINGS
  | Évalue (5 étoiles)             | Voit gains (318.75€)
  | Commentaire                    | Commission (56.25€)
  | Submit                         | Total mission (375€)
  |                                |
  V                                V
DASHBOARD                      DASHBOARD