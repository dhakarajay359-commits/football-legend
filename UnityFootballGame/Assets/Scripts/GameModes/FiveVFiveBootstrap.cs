using System.Collections.Generic;
using UnityEngine;
using ApexPitch.AI;
using ApexPitch.Ball;
using ApexPitch.Core;
using ApexPitch.Goalkeeper;
using ApexPitch.Input;
using ApexPitch.MatchRules;
using ApexPitch.Player;

namespace ApexPitch.GameModes
{
    /// <summary>
    /// Phase 1 Milestone Bootstrap: 5v5 Playable Football Match (10 players total, 3-minute clock).
    /// </summary>
    public class FiveVFiveBootstrap : MonoBehaviour
    {
        [Header("Scene References")]
        [SerializeField] private BallController ball;
        [SerializeField] private CrossPlatformInputProvider inputProvider;
        [SerializeField] private Transform homeGoalLine;
        [SerializeField] private Transform awayGoalLine;
        [SerializeField] private PlayerController playerPrefab;
        [SerializeField] private DifficultyLevel difficulty = DifficultyLevel.Professional;
        [SerializeField] private float matchDurationSeconds = 180f; // 3-minute test match

        private MatchRulesEngine _rules;
        private readonly List<PlayerController> _homePlayers = new List<PlayerController>();
        private readonly List<PlayerController> _awayPlayers = new List<PlayerController>();
        private PlayerController _controlledHome;

        private void Start()
        {
            _rules = new MatchRulesEngine(matchDurationSeconds);
            SpawnFiveVFiveSquad(0, -1f, _homePlayers, awayGoalLine);
            SpawnFiveVFiveSquad(1, 1f, _awayPlayers, homeGoalLine);
            _controlledHome = _homePlayers[4]; // Striker
        }

        private void SpawnFiveVFiveSquad(int teamId, float sideSign, List<PlayerController> list, Transform targetGoal)
        {
            Vector3[] slots =
            {
                new Vector3(sideSign * 48f, 0f, 0f),   // GK
                new Vector3(sideSign * 26f, 0f, -10f), // DEF
                new Vector3(sideSign * 26f, 0f, 10f),  // DEF
                new Vector3(sideSign * 12f, 0f, 0f),   // MID
                new Vector3(sideSign * 4f, 0f, 0f)     // FWD
            };

            for (int i = 0; i < slots.Length; i++)
            {
                var p = Instantiate(playerPrefab, slots[i], Quaternion.LookRotation(new Vector3(-sideSign, 0f, 0f)));
                p.TeamId = teamId;
                p.BindBall(ball);
                if (i == 0)
                {
                    var gk = p.gameObject.AddComponent<GoalkeeperController>();
                    gk.BindBall(ball);
                }
                else
                {
                    var brain = p.gameObject.AddComponent<AIFootballBrain>();
                    brain.Initialize(ball, targetGoal, slots[i], difficulty);
                }
                list.Add(p);
            }
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            _rules.StepClock(dt);

            if (_controlledHome != null && inputProvider != null)
            {
                var cmd = inputProvider.ReadInput(dt);
                _controlledHome.ApplyInput(cmd, dt);
            }

            if (ball != null)
            {
                Vector3 bp = ball.transform.position;
                if (_rules.CheckGoalScored(bp.x, bp.y, bp.z))
                {
                    ball.ResetToSpot(new Vector3(0f, 0.12f, 0f));
                }
            }
        }
    }
}
