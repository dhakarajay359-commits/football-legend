using UnityEngine;

namespace ApexPitch.Player
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Identity & Stats")]
        public int TeamId;
        public PlayerAttributesSO Attributes;
        [SerializeField] private Animator animator;

        [Header("Runtime State")]
        public float Stamina = 100f;
        public int YellowCards;
        public bool IsSentOff;
        public Vector3 Velocity { get; private set; }

        private CharacterController _cc;
        private Ball.BallController _ball;
        private float _actionLockTimer;
        private float _tackleCooldown;
        private float _skillCooldown;

        private static readonly int AnimSpeed = Animator.StringToHash("Speed");
        private static readonly int AnimKick = Animator.StringToHash("Kick");
        private static readonly int AnimTackle = Animator.StringToHash("Tackle");
        private static readonly int AnimSlide = Animator.StringToHash("Slide");

        private void Awake()
        {
            _cc = GetComponent<CharacterController>();
        }

        public void BindBall(Ball.BallController ball) => _ball = ball;

        public void ApplyInput(Core.MatchInputCommand cmd, float dt)
        {
            if (IsSentOff) return;
            if (_tackleCooldown > 0f) _tackleCooldown -= dt;
            if (_skillCooldown > 0f) _skillCooldown -= dt;

            if (_actionLockTimer > 0f)
            {
                _actionLockTimer -= dt;
                _cc.Move(Velocity * dt);
                Velocity = Vector3.Lerp(Velocity, Vector3.zero, dt * 6f);
                return;
            }

            Vector3 moveDir = new Vector3(cmd.MoveX, 0f, cmd.MoveZ);
            float mag = Mathf.Clamp01(moveDir.magnitude);
            bool hasBall = _ball != null && _ball.CurrentOwner == this;
            bool sprinting = cmd.Sprint && Stamina > 5f && mag > 0.1f;

            float maxSpeed = 5.5f + (Attributes.speed / 99f) * 3.1f;
            if (sprinting)
            {
                maxSpeed *= 1.32f;
                Stamina = Mathf.Max(0f, Stamina - dt * (15f - Attributes.stamina * 0.06f));
            }
            else
            {
                Stamina = Mathf.Min(100f, Stamina + dt * 7f);
            }

            if (hasBall)
            {
                maxSpeed *= Mathf.Lerp(0.84f, 0.96f, Attributes.dribbling / 99f);
            }

            float accelRate = 6f + (Attributes.acceleration / 99f) * 8f;
            Vector3 targetVel = mag > 0.05f ? moveDir.normalized * (maxSpeed * mag) : Vector3.zero;
            Velocity = Vector3.MoveTowards(Velocity, targetVel, accelRate * dt);

            if (Velocity.sqrMagnitude > 0.05f)
            {
                Quaternion targetRot = Quaternion.LookRotation(new Vector3(Velocity.x, 0f, Velocity.z));
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, dt * 12f);
            }

            _cc.Move((Velocity + Vector3.down * 9.81f) * dt);
            if (animator != null) animator.SetFloat(AnimSpeed, Velocity.magnitude);

            if (_ball != null && !hasBall)
            {
                _ball.TryClaimPossession(this);
            }

            // Skill Move
            if (cmd.SkillMove && hasBall && _skillCooldown <= 0f)
            {
                _skillCooldown = 1.0f;
                Velocity += transform.forward * 3.5f;
            }

            // Ball Actions
            if (hasBall)
            {
                Vector3 aimDir = mag > 0.1f ? moveDir.normalized : transform.forward;
                if (cmd.Shoot)
                {
                    var type = cmd.ChipModifier ? Ball.KickType.ChipShot
                        : cmd.FinesseModifier ? Ball.KickType.FinesseShot
                        : cmd.ShotPower > 0.85f ? Ball.KickType.PowerShot
                        : Ball.KickType.NormalShot;
                    float curl = cmd.FinesseModifier ? Mathf.Sign(Vector3.Dot(transform.right, aimDir)) * 0.85f : 0f;
                    _ball.Kick(this, aimDir, Mathf.Clamp(cmd.ShotPower, 0.4f, 1f), type, curl);
                    if (animator != null) animator.SetTrigger(AnimKick);
                }
                else if (cmd.Cross)
                {
                    _ball.Kick(this, aimDir, 0.8f, Ball.KickType.Cross, 0.6f);
                    if (animator != null) animator.SetTrigger(AnimKick);
                }
                else if (cmd.ThroughPass)
                {
                    _ball.Kick(this, aimDir, 0.72f, Ball.KickType.ThroughBall);
                    if (animator != null) animator.SetTrigger(AnimKick);
                }
                else if (cmd.Pass || cmd.LobPass)
                {
                    _ball.Kick(this, aimDir, cmd.LobPass ? 0.75f : 0.6f, cmd.LobPass ? Ball.KickType.LongPass : Ball.KickType.GroundPass);
                    if (animator != null) animator.SetTrigger(AnimKick);
                }
            }
            else if ((cmd.Tackle || cmd.SlideTackle) && _tackleCooldown <= 0f)
            {
                PerformTackle(cmd.SlideTackle);
            }
        }

        private void PerformTackle(bool isSlide)
        {
            _tackleCooldown = isSlide ? 1.15f : 0.7f;
            _actionLockTimer = isSlide ? 0.45f : 0.22f;
            Velocity = transform.forward * (isSlide ? 11.5f : 5.5f);
            if (animator != null) animator.SetTrigger(isSlide ? AnimSlide : AnimTackle);

            if (_ball != null && Vector3.Distance(transform.position, _ball.transform.position) < (isSlide ? 1.8f : 1.25f))
            {
                _ball.ReleasePossession(0f);
                _ball.TryClaimPossession(this);
            }
        }
    }
}
