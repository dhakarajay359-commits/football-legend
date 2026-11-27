using UnityEngine;
using ApexPitch.Core;

namespace ApexPitch.UI
{
    public class MobileSafeArea : MonoBehaviour
    {
        private RectTransform _panel;
        private Rect _lastSafeArea = Rect.zero;

        private void Awake()
        {
            _panel = GetComponent<RectTransform>();
            ApplySafeArea();
        }

        private void Update()
        {
            if (Screen.safeArea != _lastSafeArea) ApplySafeArea();
        }

        private void ApplySafeArea()
        {
            if (_panel == null) return;
            Rect safe = Screen.safeArea;
            _lastSafeArea = safe;

            Vector2 anchorMin = safe.position;
            Vector2 anchorMax = safe.position + safe.size;
            anchorMin.x /= Screen.width;
            anchorMin.y /= Screen.height;
            anchorMax.x /= Screen.width;
            anchorMax.y /= Screen.height;

            _panel.anchorMin = anchorMin;
            _panel.anchorMax = anchorMax;
        }
    }

    public static class QualityPresetManager
    {
        public static void ApplyPreset(QualityTier tier)
        {
            QualitySettings.SetQualityLevel((int)tier, true);
            Application.targetFrameRate = tier == QualityTier.Low ? 30 : 60;
        }
    }
}
