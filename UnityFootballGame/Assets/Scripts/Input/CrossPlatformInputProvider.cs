using UnityEngine;
using ApexPitch.Core;

namespace ApexPitch.Input
{
    public class CrossPlatformInputProvider : MonoBehaviour, IInputProvider
    {
        [Header("Mobile Virtual Controls")]
        public Vector2 VirtualJoystick;
        public bool MobileSprint;
        private bool _mobilePass, _mobileThrough, _mobileShoot, _mobileCross, _mobileTackle, _mobileSkill, _mobileSwitch;
        private float _shotCharge;

        public void TriggerMobileButton(string buttonName)
        {
            switch (buttonName)
            {
                case "Pass": _mobilePass = true; break;
                case "Through": _mobileThrough = true; break;
                case "Shoot": _mobileShoot = true; break;
                case "Cross": _mobileCross = true; break;
                case "Tackle": _mobileTackle = true; break;
                case "Skill": _mobileSkill = true; break;
                case "Switch": _mobileSwitch = true; break;
            }
        }

        public MatchInputCommand ReadInput(float deltaTime)
        {
            var cmd = new MatchInputCommand();

            // PC Keyboard + Gamepad
            float kbX = UnityEngine.Input.GetAxisRaw("Horizontal");
            float kbZ = UnityEngine.Input.GetAxisRaw("Vertical");

            if (VirtualJoystick.sqrMagnitude > 0.01f)
            {
                cmd.MoveX = VirtualJoystick.x;
                cmd.MoveZ = VirtualJoystick.y;
            }
            else
            {
                cmd.MoveX = kbX;
                cmd.MoveZ = kbZ;
            }

            cmd.Sprint = UnityEngine.Input.GetKey(KeyCode.LeftShift) || MobileSprint;

            if (UnityEngine.Input.GetKey(KeyCode.Space))
                _shotCharge = Mathf.Min(1f, _shotCharge + deltaTime * 1.4f);

            cmd.Shoot = UnityEngine.Input.GetKeyDown(KeyCode.Space) || _mobileShoot;
            cmd.FinesseModifier = UnityEngine.Input.GetKey(KeyCode.LeftControl);
            cmd.ChipModifier = UnityEngine.Input.GetKey(KeyCode.LeftAlt);
            cmd.Pass = UnityEngine.Input.GetKeyDown(KeyCode.K) || _mobilePass;
            cmd.ThroughPass = UnityEngine.Input.GetKeyDown(KeyCode.I) || _mobileThrough;
            cmd.Cross = UnityEngine.Input.GetKeyDown(KeyCode.L) || _mobileCross;
            cmd.Tackle = UnityEngine.Input.GetKeyDown(KeyCode.U) || _mobileTackle;
            cmd.SlideTackle = UnityEngine.Input.GetKeyDown(KeyCode.F);
            cmd.SkillMove = UnityEngine.Input.GetKeyDown(KeyCode.E) || _mobileSkill;
            cmd.SwitchPlayer = UnityEngine.Input.GetKeyDown(KeyCode.Q) || _mobileSwitch;
            cmd.ShotPower = Mathf.Max(0.55f, _shotCharge);

            if (!UnityEngine.Input.GetKey(KeyCode.Space)) _shotCharge = 0f;
            _mobilePass = _mobileThrough = _mobileShoot = _mobileCross = _mobileTackle = _mobileSkill = _mobileSwitch = false;
            return cmd;
        }

        public void SetCustomBinding(string actionName, string keyOrButton)
        {
            PlayerPrefs.SetString($"BIND_{actionName}", keyOrButton);
        }
    }
}
