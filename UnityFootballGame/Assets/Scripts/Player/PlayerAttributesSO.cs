using UnityEngine;

namespace ApexPitch.Player
{
    [CreateAssetMenu(fileName = "PlayerAttributes", menuName = "ApexPitch/Player Attributes")]
    public class PlayerAttributesSO : ScriptableObject
    {
        public string playerName = "A. Striker";
        public int jerseyNumber = 10;
        public Core.PlayerRole role = Core.PlayerRole.Forward;

        [Header("Physical & Technical (1-99)")]
        [Range(1, 99)] public int speed = 84;
        [Range(1, 99)] public int acceleration = 85;
        [Range(1, 99)] public int stamina = 82;
        [Range(1, 99)] public int shooting = 86;
        [Range(1, 99)] public int passing = 83;
        [Range(1, 99)] public int dribbling = 87;
        [Range(1, 99)] public int defending = 48;
        [Range(1, 99)] public int physicalStrength = 78;
        [Range(1, 99)] public int ballControl = 86;
        [Range(1, 99)] public int goalkeeping = 30;

        public int OverallRating => Mathf.RoundToInt(
            role == Core.PlayerRole.Goalkeeper
                ? goalkeeping * 0.65f + passing * 0.15f + physicalStrength * 0.2f
                : (speed + acceleration + shooting + passing + dribbling + defending + physicalStrength + ballControl) / 8f
        );
    }
}
