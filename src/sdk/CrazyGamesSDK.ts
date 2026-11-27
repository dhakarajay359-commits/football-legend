// Safe CrazyGames HTML5 SDK v3 wrapper (works seamlessly on CrazyGames & localhost fallback)

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: {
        init: () => Promise<void>;
        game: {
          gameplayStart: () => void;
          gameplayStop: () => void;
          happytime: () => void;
        };
        ad: {
          requestAd: (type: 'midgame' | 'rewarded', callbacks: {
            adStarted?: () => void;
            adFinished?: () => void;
            adError?: (err: unknown) => void;
          }) => void;
        };
      };
    };
  }
}

class CrazyGamesBridge {
  private initialized = false;

  public async init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (window.CrazyGames?.SDK?.init) {
        await window.CrazyGames.SDK.init();
      }
    } catch {
      // Running outside CrazyGames portal (localhost/offline)
    }
  }

  public gameplayStart() {
    try { window.CrazyGames?.SDK?.game?.gameplayStart(); } catch {}
  }

  public gameplayStop() {
    try { window.CrazyGames?.SDK?.game?.gameplayStop(); } catch {}
  }

  public happytime() {
    try { window.CrazyGames?.SDK?.game?.happytime(); } catch {}
  }

  public showMidgameAd(onMute: (muted: boolean) => void, onDone: () => void) {
    const adApi = window.CrazyGames?.SDK?.ad;
    if (!adApi) { onDone(); return; }
    try {
      adApi.requestAd('midgame', {
        adStarted: () => onMute(true),
        adFinished: () => { onMute(false); onDone(); },
        adError: () => { onMute(false); onDone(); }
      });
    } catch {
      onDone();
    }
  }

  public showRewardedAd(onMute: (muted: boolean) => void, onReward: () => void, onFail?: () => void) {
    const adApi = window.CrazyGames?.SDK?.ad;
    if (!adApi) {
      // Localhost dev fallback
      onReward();
      return;
    }
    try {
      adApi.requestAd('rewarded', {
        adStarted: () => onMute(true),
        adFinished: () => { onMute(false); onReward(); },
        adError: () => { onMute(false); onFail?.(); }
      });
    } catch {
      onFail?.();
    }
  }
}

export const cgSDK = new CrazyGamesBridge();
