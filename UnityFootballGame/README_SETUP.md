# APEX PITCH — Unity 6 Cross-Platform 3D Football Game

## 1. Opening in Unity 6
1. Install **Unity 6 (`6000.0.25f1`)** via Unity Hub with **Windows**, **Android**, **iOS**, and **Dedicated Server** build support.
2. Open the `UnityFootballGame/` folder in Unity Hub.
3. Unity will automatically resolve URP, Input System, Animation Rigging, and Addressables from `Packages/manifest.json`.

## 2. Installing Photon Fusion 2 (Server Mode)
1. Download **Photon Fusion 2** from the Unity Asset Store / Photon Dashboard and import it into `Assets/`.
2. Add `FUSION_WEAVER` to **Project Settings > Player > Scripting Define Symbols**.
3. Configure your Photon AppId in `PhotonAppSettings` (never commit real keys to public repos).

## 3. Installing PlayFab Backend
1. Import the **PlayFab Unity SDK** (`PlayFabEditorExtensions`).
2. Add `PLAYFAB_SDK` to **Scripting Define Symbols**.
3. Replace `YOUR_PLAYFAB_TITLE_ID` in `PlayFabService.cs` and `PlayFabSharedSettings` with your PlayFab Title ID.
4. Enable **PlayFab Multiplayer Servers (MPS)** for hosting dedicated headless Unity server builds.

## 4. Running C# Core Unit Tests
Run pure C# rules and match-state tests with .NET CLI:
```powershell
dotnet test UnityFootballGame/Tests/FootballCore.Tests.csproj
```
