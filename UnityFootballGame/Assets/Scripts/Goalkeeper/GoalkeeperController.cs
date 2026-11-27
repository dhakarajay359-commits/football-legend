using UnityEngine;

namespace ApexPitch.Goalkeeper
{
    public class GoalkeeperController : MonoBehaviour
    {
        [SerializeField] private Player.PlayerController player;
        [SerializeField] private Transform ownGoalLine;
        [SerializeField] private Animator animator;

        private Ball.BallController _ball;
        private float _diveTimer;
        private Vector3 _diveVelocity;

        private static readonly int AnimDiveLeft = Animator.StringToHash("DiveLeft");
        private static readonly int AnimDiveRight = Animator.StringToHash("DiveRight");

        public void BindBall(Ball.BallController ball) => _ball = ball;

        public void TickGoalkeeperAI(float dt, float difficultyMultiplier)
        {
            if (_ball == null || ownGoalLine == null) return;

            if (_diveTimer > 0f)
            {
                _diveTimer -= dt;
                transform.position += _diveVelocity * dt;
                if (Vector3.Distance(transform.position, _ball.transform.position) < 1.35f)
                {
                    // Parry or catch
                    _ball.Rb.linearVelocity = (ownGoalLine.forward + Vector3.up * 0.25f).normalized * 12f;
                }
                return;
            }

            if (_ball.CurrentOwner == player)
            {
                // Distribute ball forward
                _ball.Kick(player, ownGoalLine.forward, 0.75f, Ball.KickType.LongPass);
                return;
            }

            // Track ball laterally along goal mouth
            Vector3 goalPos = ownGoalLine.position;
            float clampedZ = Mathf.Clamp(_ball.transform.position.z * 0.55f, -3.2f, 3.2f);
            Vector3 target = new Vector3(goalPos.x + ownGoalLine.forward.x * 1.4f, transform.position.y, clampedZ);
            float moveSpeed = (5.2f + (player.Attributes.goalkeeping / 99f) * 2.8f) * difficultyMultiplier;
            transform.position = Vector3.MoveTowards(transform.position, target, moveSpeed * dt);
            transform.LookAt(new Vector3(_ball.transform.position.x, transform.position.y, _ball.transform.position.z));

            // Detect incoming shot & trigger dive
            float distToBall = Vector3.Distance(transform.position, _ball.transform.position);
            Vector3 toGoal = (goalPos - _ball.transform.position).normalized;
            float approachingSpeed = Vector3.Dot(_ball.Rb.linearVelocity, toGoal);

            if (approachingSpeed > 12f && distToBall < 15f)
            {
                float side = Mathf.Sign(_ball.transform.position.z - transform.position.z);
                _diveTimer = 0.65f;
                _diveVelocity = Vector3.forward * (side * (6.5f + player.Attributes.goalkeeping * 0.03f));
                if (animator != null) animator.SetTrigger(side < 0 ? AnimDiveLeft : AnimDiveRight);
            }
        }
    }
}
