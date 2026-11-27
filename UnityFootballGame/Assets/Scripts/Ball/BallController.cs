using UnityEngine;

namespace ApexPitch.Ball
{
    public enum KickType { GroundPass, LongPass, ThroughBall, Cross, NormalShot, PowerShot, FinesseShot, ChipShot, Volley, Header }

    [RequireComponent(typeof(Rigidbody), typeof(SphereCollider))]
    public class BallController : MonoBehaviour
    {
        [Header("Physics Constants")]
        [SerializeField] private float groundFriction = 1.65f;
        [SerializeField] private float airDrag = 0.22f;
        [SerializeField] private float magnusCoefficient = 0.042f;
        [SerializeField] private float possessionSnapRadius = 0.95f;

        public Rigidbody Rb { get; private set; }
        public Player.PlayerController CurrentOwner { get; private set; }
        public Player.PlayerController LastTouchPlayer { get; private set; }
        public int LastTouchTeamId { get; private set; } = -1;
        public Vector3 SpinVector { get; private set; }

        private float _pickupLockTimer;

        private void Awake()
        {
            Rb = GetComponent<Rigidbody>();
            Rb.mass = 0.43f; // Standard FIFA match ball (430g)
            Rb.interpolation = RigidbodyInterpolation.Interpolate;
            Rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        }

        private void FixedUpdate()
        {
            if (_pickupLockTimer > 0f) _pickupLockTimer -= Time.fixedDeltaTime;

            // Magnus effect (curved shots & crosses)
            if (SpinVector.sqrMagnitude > 0.001f && Rb.linearVelocity.sqrMagnitude > 1f)
            {
                Vector3 magnusForce = Vector3.Cross(SpinVector, Rb.linearVelocity) * magnusCoefficient;
                Rb.AddForce(magnusForce, ForceMode.Force);
                SpinVector = Vector3.Lerp(SpinVector, Vector3.zero, Time.fixedDeltaTime * 0.9f);
            }

            // Ground vs Air drag
            bool isGrounded = transform.position.y <= 0.26f && Mathf.Abs(Rb.linearVelocity.y) < 0.5f;
            Rb.linearDamping = isGrounded ? groundFriction : airDrag;

            // Controlled possession (non-permanent physical dribble)
            if (CurrentOwner != null)
            {
                Vector3 dribbleAnchor = CurrentOwner.transform.position + CurrentOwner.transform.forward * 0.65f;
                dribbleAnchor.y = 0.11f;
                Vector3 toAnchor = dribbleAnchor - transform.position;
                Rb.linearVelocity = toAnchor * 14f + CurrentOwner.Velocity * 0.85f;
            }
        }

        public bool TryClaimPossession(Player.PlayerController player)
        {
            if (_pickupLockTimer > 0f || CurrentOwner == player) return false;
            float dist = Vector3.Distance(transform.position, player.transform.position);
            if (dist > possessionSnapRadius || transform.position.y > 1.35f) return false;

            CurrentOwner = player;
            LastTouchPlayer = player;
            LastTouchTeamId = player.TeamId;
            SpinVector = Vector3.zero;
            return true;
        }

        public void ReleasePossession(float lockDuration = 0.2f)
        {
            CurrentOwner = null;
            _pickupLockTimer = lockDuration;
        }

        public void Kick(Player.PlayerController kicker, Vector3 direction, float power01, KickType kickType, float curlAmount = 0f)
        {
            CurrentOwner = null;
            LastTouchPlayer = kicker;
            LastTouchTeamId = kicker.TeamId;
            _pickupLockTimer = 0.22f;

            Vector3 dir = direction.normalized;
            float speed = 16f;
            float loft = 0.1f;

            switch (kickType)
            {
                case KickType.GroundPass:
                    speed = Mathf.Lerp(11f, 22f, power01);
                    loft = 0.04f;
                    break;
                case KickType.ThroughBall:
                    speed = Mathf.Lerp(14f, 26f, power01);
                    loft = 0.08f;
                    break;
                case KickType.LongPass:
                case KickType.Cross:
                    speed = Mathf.Lerp(17f, 27f, power01);
                    loft = 0.42f;
                    break;
                case KickType.NormalShot:
                    speed = Mathf.Lerp(20f, 32f, power01);
                    loft = 0.18f;
                    break;
                case KickType.PowerShot:
                    speed = Mathf.Lerp(26f, 38f, power01);
                    loft = 0.14f;
                    break;
                case KickType.FinesseShot:
                    speed = Mathf.Lerp(19f, 29f, power01);
                    loft = 0.24f;
                    break;
                case KickType.ChipShot:
                    speed = Mathf.Lerp(13f, 20f, power01);
                    loft = 0.62f;
                    break;
                case KickType.Volley:
                case KickType.Header:
                    speed = Mathf.Lerp(22f, 34f, power01);
                    loft = 0.12f;
                    break;
            }

            Vector3 launch = (dir + Vector3.up * loft).normalized * speed;
            Rb.linearVelocity = launch;
            SpinVector = Vector3.up * (curlAmount * 12f);
        }

        public void ResetToSpot(Vector3 position)
        {
            CurrentOwner = null;
            _pickupLockTimer = 0f;
            SpinVector = Vector3.zero;
            Rb.linearVelocity = Vector3.zero;
            Rb.angularVelocity = Vector3.zero;
            transform.position = position;
        }
    }
}
