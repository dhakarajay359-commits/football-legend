using System;
using System.Collections.Generic;
using ApexPitch.Core;

namespace ApexPitch.MatchRules
{
    [Serializable]
    public class MatchStats
    {
        public int Shots;
        public int ShotsOnTarget;
        public int PassesAttempted;
        public int PassesCompleted;
        public int Tackles;
        public int Fouls;
        public int Corners;
        public int Offsides;
        public int Saves;
        public int PossessionTicks;
    }

    /// <summary>
    /// Pure C# authoritative match rules and clock state machine.
    /// Shared by offline MatchManager MonoBehaviour, dedicated Photon Fusion 2 server, and unit tests.
    /// </summary>
    public class MatchRulesEngine
    {
        public const float PitchHalfLength = 52.5f;
        public const float PitchHalfWidth = 34.0f;
        public const float GoalHalfWidth = 3.66f;
        public const float GoalHeight = 2.44f;

        public MatchPhase Phase { get; private set; } = MatchPhase.KickOff;
        public int HomeScore { get; private set; }
        public int AwayScore { get; private set; }
        public float ElapsedSeconds { get; private set; }
        public float MatchDurationSeconds { get; }
        public float InjuryTimeSeconds { get; private set; }
        public MatchStats HomeStats { get; } = new MatchStats();
        public MatchStats AwayStats { get; } = new MatchStats();
        public List<string> EventLog { get; } = new List<string>();

        private float _phaseTimer = 1.5f;

        public MatchRulesEngine(float matchDurationSeconds = 180f)
        {
            MatchDurationSeconds = matchDurationSeconds;
        }

        public int DisplayMinute
        {
            get
            {
                float ratio = Math.Clamp(ElapsedSeconds / Math.Max(1f, MatchDurationSeconds), 0f, 1f);
                return (int)Math.Floor(ratio * 90f);
            }
        }

        public void StepClock(float dt)
        {
            if (Phase == MatchPhase.FullTime || Phase == MatchPhase.Abandoned) return;

            if (Phase == MatchPhase.KickOff || Phase == MatchPhase.HalfTime)
            {
                _phaseTimer -= dt;
                if (_phaseTimer <= 0f)
                {
                    Phase = ElapsedSeconds < MatchDurationSeconds * 0.5f ? MatchPhase.FirstHalf : MatchPhase.SecondHalf;
                }
                return;
            }

            if (Phase == MatchPhase.FirstHalf || Phase == MatchPhase.SecondHalf || Phase == MatchPhase.InjuryTime)
            {
                ElapsedSeconds += dt;
                float halfTime = MatchDurationSeconds * 0.5f;
                if (Phase == MatchPhase.FirstHalf && ElapsedSeconds >= halfTime)
                {
                    Phase = MatchPhase.HalfTime;
                    _phaseTimer = 3.0f;
                    EventLog.Add($"HT: {HomeScore} - {AwayScore}");
                }
                else if (Phase == MatchPhase.SecondHalf && ElapsedSeconds >= MatchDurationSeconds)
                {
                    if (InjuryTimeSeconds > 0f)
                    {
                        Phase = MatchPhase.InjuryTime;
                    }
                    else
                    {
                        Phase = MatchPhase.FullTime;
                        EventLog.Add($"FT: {HomeScore} - {AwayScore}");
                    }
                }
                else if (Phase == MatchPhase.InjuryTime && ElapsedSeconds >= MatchDurationSeconds + InjuryTimeSeconds)
                {
                    Phase = MatchPhase.FullTime;
                    EventLog.Add($"FT: {HomeScore} - {AwayScore}");
                }
            }
        }

        public bool CheckGoalScored(float ballX, float ballY, float ballZ)
        {
            if (Phase != MatchPhase.FirstHalf && Phase != MatchPhase.SecondHalf && Phase != MatchPhase.InjuryTime)
                return false;

            if (Math.Abs(ballX) > PitchHalfLength && Math.Abs(ballZ) < GoalHalfWidth && ballY < GoalHeight)
            {
                bool homeScored = ballX > 0f;
                if (homeScored) HomeScore++; else AwayScore++;
                Phase = MatchPhase.KickOff;
                _phaseTimer = 2.0f;
                EventLog.Add($"GOAL ({DisplayMinute}'): {(homeScored ? "Home" : "Away")}! {HomeScore}-{AwayScore}");
                return true;
            }
            return false;
        }

        public bool IsOffside(float receiverX, float ballX, float secondLastDefenderX, int attackDir)
        {
            // Must be in opponent half and ahead of both ball and 2nd-last opponent
            if (receiverX * attackDir <= 0f) return false;
            return (receiverX * attackDir > ballX * attackDir) && (receiverX * attackDir > secondLastDefenderX * attackDir + 0.35f);
        }

        public void RecordFoul(int offendingTeamId, bool insidePenaltyBox, bool reckless)
        {
            var stats = offendingTeamId == 0 ? HomeStats : AwayStats;
            stats.Fouls++;
            InjuryTimeSeconds += 2f;
            Phase = insidePenaltyBox ? MatchPhase.PenaltyKick : MatchPhase.FreeKick;
            EventLog.Add(reckless ? $"Yellow Card & {(insidePenaltyBox ? "Penalty" : "Free Kick")}" : "Foul");
        }
    }
}
