using System;
using System.Collections.Generic;
using UnityEngine;

namespace ApexPitch.GameModes
{
    public enum GameModeType
    {
        QuickMatch,
        PracticeMatch,
        PenaltyShootout,
        FreeKickChallenge,
        TrainingGround,
        LeagueSeason,
        KnockoutTournament,
        PlayerCareer,
        OnlineFriendly,
        OnlineRanked,
        OnlinePrivateRoom,
        OnlineTournament,
        LiveEvent
    }

    [Serializable]
    public class CareerProgressData
    {
        public string playerName = "A. Striker";
        public Core.PlayerRole position = Core.PlayerRole.Forward;
        public int level = 1;
        public int experience;
        public int goals;
        public int assists;
        public int matchesPlayed;
        public int coins = 1000;
        public string currentClubId = "apex_fc";
    }

    public class GameModeManager : MonoBehaviour
    {
        public GameModeType ActiveMode { get; private set; } = GameModeType.QuickMatch;
        public CareerProgressData Career { get; private set; } = new CareerProgressData();

        public void LaunchMode(GameModeType mode)
        {
            ActiveMode = mode;
            Debug.Log($"[ApexPitch] Launching Game Mode: {mode}");
        }

        public void RecordCareerMatch(int goals, int assists, bool won)
        {
            Career.matchesPlayed++;
            Career.goals += goals;
            Career.assists += assists;
            Career.experience += won ? 200 : 80;
            Career.coins += won ? 300 : 100;
            while (Career.experience >= Career.level * 500)
            {
                Career.experience -= Career.level * 500;
                Career.level++;
            }
        }
    }
}
