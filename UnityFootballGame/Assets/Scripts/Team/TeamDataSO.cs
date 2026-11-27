using System.Collections.Generic;
using UnityEngine;

namespace ApexPitch.Team
{
    public enum FormationType { F433, F442, F4231, F352, F4141, F532 }
    public enum TeamTactic { Balanced, HighPress, CounterAttack, Possession, UltraDefensive }

    [CreateAssetMenu(fileName = "TeamData", menuName = "ApexPitch/Team Data")]
    public class TeamDataSO : ScriptableObject
    {
        public string teamId = "apex_fc";
        public string teamName = "Apex United";
        public string shortCode = "APX";
        public bool isNationalTeam;

        [Header("Original Kit & Colors")]
        public Color primaryColor = new Color(0.05f, 0.65f, 0.92f);
        public Color secondaryColor = Color.white;
        public Color shortsColor = new Color(0.06f, 0.09f, 0.16f);
        public Sprite badgeSprite;

        [Header("Formation & Squad")]
        public FormationType defaultFormation = FormationType.F433;
        public TeamTactic defaultTactic = TeamTactic.Balanced;
        public int captainIndex = 7;
        public List<Player.PlayerAttributesSO> startingEleven = new List<Player.PlayerAttributesSO>();
        public List<Player.PlayerAttributesSO> substitutes = new List<Player.PlayerAttributesSO>();
    }
}
