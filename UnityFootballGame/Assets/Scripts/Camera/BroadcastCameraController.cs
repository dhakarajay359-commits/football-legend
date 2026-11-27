using UnityEngine;

namespace ApexPitch.CameraSystem
{
    public enum CameraPreset { Broadcast, DynamicThirdPerson, TeleWide, ProCamera }

    public class BroadcastCameraController : MonoBehaviour
    {
        [SerializeField] private Transform ballTarget;
        [SerializeField] private CameraPreset preset = CameraPreset.Broadcast;
        [Range(0.7f, 1.5f)] public float zoom = 1.0f;
        [Range(-0.5f, 0.5f)] public float angleOffset = 0f;

        private Vector3 _velocity;

        private void LateUpdate()
        {
            if (ballTarget == null) return;
            Vector3 bp = ballTarget.position;

            Vector3 desiredPos = preset switch
            {
                CameraPreset.Broadcast => new Vector3(bp.x * 0.78f + angleOffset * 14f, 21f / zoom, 31f / zoom + bp.z * 0.45f),
                CameraPreset.DynamicThirdPerson => new Vector3(bp.x - 16f / zoom, 11f / zoom, bp.z + 14f / zoom),
                CameraPreset.TeleWide => new Vector3(bp.x * 0.6f, 32f / zoom, 40f / zoom + bp.z * 0.25f),
                _ => new Vector3(bp.x - 10f / zoom, 5.5f / zoom, bp.z)
            };

            transform.position = Vector3.SmoothDamp(transform.position, desiredPos, ref _velocity, 0.14f);
            transform.LookAt(new Vector3(bp.x * 0.9f, 0.6f, bp.z * 0.7f));
        }
    }
}
