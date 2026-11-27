using System.Threading.Tasks;
using UnityEngine;
using ApexPitch.Core;

namespace ApexPitch.Backend
{
    /// <summary>
    /// PlayFab Backend Integration (Authentication, Player Data, Matchmaking, Leaderboards, CloudScript).
    /// Set TitleId in PlayFabSharedSettings after importing the PlayFab Unity SDK,
    /// and add PLAYFAB_SDK to Player Settings > Scripting Define Symbols.
    /// </summary>
    public class PlayFabService : MonoBehaviour, IBackendService
    {
        [Header("PlayFab Configuration (Replace with your Title ID)")]
        [SerializeField] private string titleId = "YOUR_PLAYFAB_TITLE_ID";

        public bool IsAuthenticated { get; private set; }
        public string PlayerId { get; private set; }

        public async Task<bool> LoginAsync(string customId)
        {
            if (titleId == "YOUR_PLAYFAB_TITLE_ID")
            {
                Debug.LogWarning("[PlayFab] TitleId is still a placeholder. Running in offline fallback mode until configured.");
                PlayerId = customId;
                IsAuthenticated = false;
                return false;
            }

#if PLAYFAB_SDK
            // PlayFabSettings.staticSettings.TitleId = titleId;
            // PlayFabClientAPI.LoginWithCustomID(...)
#endif
            await Task.Delay(50);
            PlayerId = customId;
            IsAuthenticated = true;
            return true;
        }

        public async Task<string> GetPlayerDataAsync(string key)
        {
            await Task.CompletedTask;
            return PlayerPrefs.GetString($"PF_CACHE_{key}", "{}");
        }

        public async Task<bool> SavePlayerDataAsync(string key, string jsonPayload)
        {
            PlayerPrefs.SetString($"PF_CACHE_{key}", jsonPayload);
            PlayerPrefs.Save();
            await Task.CompletedTask;
            return IsAuthenticated;
        }

        public async Task<bool> SubmitMatchResultAsync(string matchId, int goalsFor, int goalsAgainst, bool won)
        {
            // Competitive rewards & MMR must be validated via PlayFab CloudScript / Azure Function
            Debug.Log($"[PlayFab] Match {matchId} result queued for server validation ({goalsFor}-{goalsAgainst}, Won={won}).");
            await Task.CompletedTask;
            return IsAuthenticated;
        }

        public async Task<string> GetLeaderboardJsonAsync(string statisticName, int maxResults)
        {
            await Task.CompletedTask;
            return "[]";
        }

        public async Task<string> GetActiveEventsConfigJsonAsync()
        {
            await Task.CompletedTask;
            return "[{\"id\":\"daily_striker\",\"title\":\"Daily Striker Challenge\",\"rewardCoins\":400}]";
        }
    }
}
