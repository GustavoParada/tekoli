/**
 * Generates synthetic Discord-style notification sounds via Web Audio API
 */
export function playDiscordPingSound(enabled: boolean = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Discord notification tone chord (gentle two-tone chime)
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  } catch (_) {
    // Ignore audio autoplay restrictions
  }
}
