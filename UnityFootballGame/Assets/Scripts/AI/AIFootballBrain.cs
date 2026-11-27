using UnityEngine;
using ApexPitch.Core;

namespace ApexPitch.AI
{
    public enum AIState { HoldFormation, PressBall, SupportAttack, DribbleToGoal, PassOrShoot }

    public class AIFootballBrain : MonoBehaviour
    {
        [SerializeField] private Player.PlayerController player;
        [SerializeField] private Vector3 formationAnchor;
        [SerializeField] private DifficultyLevel difficulty = DifficultyLevel.Professional;

        public AIState CurrentState { get; private set; } = AIState.HoldFormation;
        private Ball.BallController _ball;
        private Transform _opponentGoal;

        public void Initialize(Ball.BallController ball, Transform opponentGoal, Vector3 anchor, DifficultyLevel diff)
        {
            _ball = ball;
            _opponentGoal = opponentGoal;
            formationAnchor = anchor;
            difficulty = diff;
        }

        public void TickAI(float dt, bool isClosestDefender)
        {
            if (_ball == null || player == null || player.IsSentOff) return;

            float reactionScale = difficulty switch
            {
                DifficultyLevel.Beginner => 0.55f,
                DifficultyLevel.Amateur => 0.72f,
                DifficultyLevel.Professional => 0.86f,
                DifficultyLevel.WorldClass => 0.95f,
                DifficultyLevel.Legendary => 1.05f,
                _ => 0.85f
            };

            var cmd = new MatchInputCommand();
            bool hasBall = _ball.CurrentOwner == player;

            if (hasBall && _opponentGoal != null)
            {
                CurrentState = AIState.DribbleToGoal;
                Vector3 toGoal = _opponentGoal.position - transform.position;
                float dist = toGoal.magnitude;
                Vector3 dir = toGoal.normalized;
                cmd.MoveX = dir.x;
                cmd.MoveZ = dir.z;
                cmd.Sprint = dist > 18f;

                if (dist < 22f && Random.value < 0.04f * reactionScale)
                {
                    cmd.Shoot = true;
                    cmd.ShotPower = 0.78f;
                }
            }
            else if (isClosestDefender)
            {
                CurrentState = AIState.PressBall;
                Vector3 toBall = _ball.transform.position - transform.position;
                float dist = toBall.magnitude;
                Vector3 dir = toBall.normalized;
                cmd.MoveX = dir.x;
                cmd.MoveZ = dir.z;
                cmd.Sprint = dist > 6f;
                if (dist < 1.35f && _ball.CurrentOwner != null && _ball.CurrentOwner.TeamId != player.TeamId)
                {
                    cmd.Tackle = Random.value < 0.15f * reactionScale;
                }
            }
            else
            {
                CurrentState = AIState.HoldFormation;
                Vector3 shiftedAnchor = formationAnchor + (_ball.transform.position * 0.3f);
                Vector3 toAnchor = shiftedAnchor - transform.position;
                if (toAnchor.magnitude > 1.0f)
                {
                    Vector3 dir = toAnchor.normalized;
                    cmd.MoveX = dir.x;
                    cmd.MoveZ = dir.z;
                    cmd.Sprint = toAnchor.magnitude > 12f;
                }
            }

            player.ApplyInput(cmd, dt);
        }
    }
}
