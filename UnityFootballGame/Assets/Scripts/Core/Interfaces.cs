using System;
using System.Threading.Tasks;

namespace ApexPitch.Core
{
    public enum PlatformTarget { WindowsPC, Android, iOS }
    public enum QualityTier { Low, Medium, High, Ultra }
    public enum DifficultyLevel { Beginner, Amateur, Professional, WorldClass, Legendary }
    public enum PlayerRole { Goalkeeper, Defender, Midfielder, Forward }

    public enum MatchPhase
    {
        PreMatch,
        KickOff,
        FirstHalf,
        HalfTime,
        SecondHalf,
        InjuryTime,
        FullTime,
        ThrowIn,
        GoalKick,
        CornerKick,
        FreeKick,
        PenaltyKick,
        Abandoned
    }

    public struct MatchInputCommand
    {
        public float MoveX;
        public float MoveZ;
        public bool Sprint;
        public bool Pass;
        public bool ThroughPass;
        public bool LobPass;
        public bool Shoot;
        public bool FinesseModifier;
        public bool ChipModifier;
        public bool Cross;
        public bool Tackle;
        public bool SlideTackle;
        public bool SkillMove;
        public bool SwitchPlayer;
        public float ShotPower;
    }

    public interface IInputProvider
    {
        MatchInputCommand ReadInput(float deltaTime);
        void SetCustomBinding(string actionName, string keyOrButton);
    }

    public interface INetworkMatchService
    {
        bool IsConnected { get; }
        bool IsServerAuthoritative { get; }
        Task<bool> ConnectAsync(string region);
        Task<bool> JoinOrCreatePrivateRoomAsync(string roomCode, int maxPlayers);
        Task<bool> StartMatchmakingAsync(string queueName, bool ranked);
        void SendInputCommand(MatchInputCommand cmd);
        Task<bool> TryReconnectAsync(string roomCode, string sessionToken);
    }

    public interface IBackendService
    {
        bool IsAuthenticated { get; }
        string PlayerId { get; }
        Task<bool> LoginAsync(string customId);
        Task<string> GetPlayerDataAsync(string key);
        Task<bool> SavePlayerDataAsync(string key, string jsonPayload);
        Task<bool> SubmitMatchResultAsync(string matchId, int goalsFor, int goalsAgainst, bool won);
        Task<string> GetLeaderboardJsonAsync(string statisticName, int maxResults);
        Task<string> GetActiveEventsConfigJsonAsync();
    }
}
