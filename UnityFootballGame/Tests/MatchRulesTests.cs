using Xunit;
using ApexPitch.Core;
using ApexPitch.MatchRules;

namespace ApexPitch.Tests
{
    public class MatchRulesTests
    {
        [Fact]
        public void MatchClock_TransitionsFromKickOffToHalfTimeAndFullTime()
        {
            var rules = new MatchRulesEngine(120f);
            Assert.Equal(MatchPhase.KickOff, rules.Phase);

            // Advance past kickoff timer (1.5s)
            for (int i = 0; i < 100; i++) rules.StepClock(0.02f);
            Assert.Equal(MatchPhase.FirstHalf, rules.Phase);

            // Advance to half-time (60s)
            for (int i = 0; i < 3005; i++) rules.StepClock(0.02f);
            Assert.Equal(MatchPhase.HalfTime, rules.Phase);

            // Advance past half-time break (3s) + second half (60s)
            for (int i = 0; i < 3200; i++) rules.StepClock(0.02f);
            Assert.Equal(MatchPhase.FullTime, rules.Phase);
        }

        [Fact]
        public void GoalDetection_ScoresForHomeWhenBallCrossesPositiveGoalLine()
        {
            var rules = new MatchRulesEngine(120f);
            for (int i = 0; i < 100; i++) rules.StepClock(0.02f); // Enter FirstHalf

            bool scored = rules.CheckGoalScored(53.0f, 1.1f, 0.5f);
            Assert.True(scored);
            Assert.Equal(1, rules.HomeScore);
            Assert.Equal(0, rules.AwayScore);
        }

        [Fact]
        public void OffsideDetection_FlagsAttackerAheadOfBallAndSecondLastDefender()
        {
            var rules = new MatchRulesEngine(120f);
            Assert.True(rules.IsOffside(receiverX: 35f, ballX: 25f, secondLastDefenderX: 30f, attackDir: 1));
            Assert.False(rules.IsOffside(receiverX: 28f, ballX: 25f, secondLastDefenderX: 30f, attackDir: 1));
            Assert.False(rules.IsOffside(receiverX: -5f, ballX: -10f, secondLastDefenderX: -15f, attackDir: 1));
        }

        [Fact]
        public void FoulInPenaltyBox_AwardsPenaltyKick()
        {
            var rules = new MatchRulesEngine(120f);
            rules.RecordFoul(offendingTeamId: 1, insidePenaltyBox: true, reckless: true);
            Assert.Equal(MatchPhase.PenaltyKick, rules.Phase);
            Assert.Equal(1, rules.AwayStats.Fouls);
        }
    }
}
