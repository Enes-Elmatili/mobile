// modules/fixed-hinge/android/.../FixedHingeModule.kt
// La charnière des pliables Android, même contrat que la version iOS :
//   - posture et pli : Jetpack WindowManager (FoldingFeature)
//   - angle          : capteur TYPE_HINGE_ANGLE (Android 11+), effets seulement
// Lecture seule : aucun réglage, aucun réseau. Le pli est rendu en dp, repère
// fenêtre — l'unité de React Native.
package expo.modules.fixedhinge

import android.app.Activity
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private const val CHANGE_EVENT = "onChange"
private const val ANGLE_EVENT = "onAngle"

class FixedHingeModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var layoutJob: Job? = null

  @Volatile private var state: Map<String, Any>? = null
  @Volatile private var angleDegrees: Double? = null
  /** Dernier pli vu par WindowManager ; null quand aucun pli ne traverse la fenêtre. */
  @Volatile private var fold: Map<String, Any>? = null
  @Volatile private var foldPosture: String? = null

  private val sensorManager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private val angleListener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      val degrees = event.values.firstOrNull()?.toDouble()?.roundToInt()?.toDouble() ?: return
      if (degrees == angleDegrees) return
      angleDegrees = degrees
      sendEvent(ANGLE_EVENT, mapOf("degrees" to degrees))
      // Sans pli dans la fenêtre (écran externe), la posture vient du capteur.
      if (fold == null) publish()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  override fun definition() = ModuleDefinition {
    Name("FixedHinge")

    Events(CHANGE_EVENT, ANGLE_EVENT)

    Function("getState") { state }

    Function("getAngle") { angleDegrees }

    OnCreate { startAngle() }

    OnActivityEntersForeground { appContext.currentActivity?.let { observe(it) } }

    OnActivityEntersBackground {
      layoutJob?.cancel()
      layoutJob = null
    }

    OnDestroy {
      sensorManager?.unregisterListener(angleListener)
      scope.cancel()
    }
  }

  private fun startAngle() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val manager = sensorManager ?: return
    val sensor = manager.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE) ?: return
    manager.registerListener(angleListener, sensor, SensorManager.SENSOR_DELAY_UI)
  }

  private fun observe(activity: Activity) {
    layoutJob?.cancel()
    val density = activity.resources.displayMetrics.density
    layoutJob = scope.launch {
      WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity).collect { info ->
        val feature = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()
        if (feature == null) {
          fold = null
          foldPosture = null
        } else {
          val b = feature.bounds
          fold = mapOf(
            "x" to b.left / density.toDouble(),
            "y" to b.top / density.toDouble(),
            "width" to b.width() / density.toDouble(),
            "height" to b.height() / density.toDouble(),
            "separating" to feature.isSeparating,
          )
          foldPosture = if (feature.state == FoldingFeature.State.HALF_OPENED) "partially-open" else "fully-open"
        }
        publish()
      }
    }
  }

  /** Même forme que iOS : { posture, fold? } ; null quand l'appareil n'a pas de charnière. */
  private fun publish() {
    val posture = foldPosture ?: angleDegrees?.let { postureFromAngle(it) }
    val next: Map<String, Any>? = posture?.let { p ->
      buildMap {
        put("posture", p)
        fold?.let { put("fold", it) }
      }
    }
    if (next == state) return
    state = next
    sendEvent(CHANGE_EVENT, mapOf("state" to next))
  }

  // Capteur seul : 10° ou moins = fermé, 170° ou plus = à plat (seuils Android).
  private fun postureFromAngle(degrees: Double): String = when {
    degrees <= 10 -> "closed"
    degrees >= 170 -> "fully-open"
    else -> "partially-open"
  }
}
