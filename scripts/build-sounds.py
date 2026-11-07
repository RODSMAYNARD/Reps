"""Gera os sons do app (WAV 16 bit, mono, 44,1 kHz) por síntese: tudo original, sem arquivos de terceiros.
Uso: python scripts/build-sounds.py  ->  assets/sounds/*.wav
rest_* = alarme de fim do descanso (também entram no plugin expo-notifications, em app.json); sfx_* = só dentro do app."""
import os, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def env(d, attack=0.004, decay=0.3):
    x = t(d); return np.minimum(1, x / attack) * np.exp(-x / decay)
def sine(f, d, decay=0.3, attack=0.004, amp=1.0): return amp * np.sin(2 * np.pi * f * t(d)) * env(d, attack, decay)
def add(*sigs):
    out = np.zeros(max(len(s) for s in sigs))
    for s in sigs: out[:len(s)] += s
    return out
def place(buf, sig, at):
    i = int(SR * at); n = min(len(sig), len(buf) - i)
    if n > 0: buf[i:i + n] += sig[:n]
def bell(f, d=1.4, decay=0.55, amp=1.0):
    """Sino batido: parciais inarmônicos (razões de sino) com decaimento mais rápido nos agudos."""
    out = np.zeros(int(SR * d))
    for r, a, k in [(1, 1.0, 1.0), (2.0, 0.55, 0.7), (2.76, 0.45, 0.55), (5.4, 0.3, 0.35), (8.93, 0.16, 0.2)]:
        out += sine(f * r, d, decay * k, 0.002, a)
    return amp * out / 2.2
def noise_burst(d, decay=0.02, lp=0.5):
    n = rng.standard_normal(int(SR * d)) * env(d, 0.0005, decay)
    k = max(1, int(1 / max(lp, 0.01))); return np.convolve(n, np.ones(k) / k, mode='same')
def sweep(f0, f1, d, amp=1.0, harm=(1, .5, .25)):
    x = t(d); f = f0 * (f1 / f0) ** (x / d); ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(a * np.sin(h * ph) for h, a in zip(range(1, len(harm) + 1), harm))
    return amp * s / sum(harm) * np.minimum(1, x / 0.02) * np.minimum(1, (d - x) / 0.08)

def save(name, sig):
    sig = sig / max(1e-9, np.max(np.abs(sig))) * 0.9
    fade = int(SR * 0.012); sig[-fade:] *= np.linspace(1, 0, fade)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767).astype('<i2').tobytes())
    print(name, f'{len(sig) / SR:.2f}s', os.path.getsize(path) // 1024, 'KB')

def build():
    os.makedirs(OUT, exist_ok=True)
    # Default: dois toques suaves de carrilhão (A5, E6)
    b = np.zeros(int(SR * 1.1)); place(b, sine(880, .8, .22), 0); place(b, sine(1318.5, .8, .28), 0.22); save('rest_default', b)
    # Alarm: bipes de relógio, duas séries de quatro
    b = np.zeros(int(SR * 1.9))
    for s in (0, 1.0):
        for k in range(4):
            x = t(.1); beep = (np.sin(2 * np.pi * 1760 * x) + 0.3 * np.sin(2 * np.pi * 5280 * x)) * np.minimum(1, x / .004) * np.minimum(1, (.1 - x) / .01)
            place(b, beep, s + k * 0.15)
    save('rest_alarm', b)
    # Futuristic: três notas que sobem com brilho, mais um "shimmer"
    b = np.zeros(int(SR * 1.5))
    for k, (f0, f1) in enumerate([(330, 392), (440, 523), (659, 988)]): place(b, sweep(f0, f1, .32, .8, (1, .6, .35, .2)) * np.exp(-t(.32) / .5), k * .2)
    place(b, add(sine(1976, .9, .35, .02, .35), sine(2637, .9, .25, .02, .2)), .55); save('rest_futuristic', b)
    # Ting Ting: dois "tings" agudos e brilhantes
    b = np.zeros(int(SR * 1.3)); place(b, bell(2093, .9, .16), 0); place(b, bell(2637, .9, .16), .42); save('rest_ting', b)
    # Boxing Bell: três badaladas de sino grave e longo
    b = np.zeros(int(SR * 3.0))
    for k in range(3): place(b, bell(587, 1.6, .75), k * .62)
    save('rest_boxing', b)
    # Iron Clink (original): anilhas de ferro batendo (duas batidas curtas e secas)
    b = np.zeros(int(SR * 1.0))
    for at, amp in [(0, 1.0), (.13, .75)]:
        hit = add(noise_burst(.12, .012, .35) * .9, sine(1840, .5, .06) * .5, sine(2960, .4, .045) * .35, sine(4180, .3, .03) * .25, sine(130, .3, .05) * .6)
        place(b, amp * hit, at)
    save('rest_iron', b)
    # Rack Pop (original): marimba de madeira em três notas (C5 E5 G5)
    b = np.zeros(int(SR * 1.0))
    for k, f in enumerate([523.25, 659.25, 783.99]): place(b, add(sine(f, .5, .13, .002), sine(f * 4, .3, .03, .001, .35), sine(f * 9.9, .2, .012, .001, .12)), k * .12)
    save('rest_marimba', b)
    # Lift Off (original): varredura que sobe e fecha com um brilho
    b = np.zeros(int(SR * 1.3)); place(b, sweep(220, 1480, .62, 1.0, (1, .5, .3)), 0); place(b, bell(2217, .6, .22, .8), .6); save('rest_liftoff', b)
    # SFX do app: tique curto ao marcar a série e fanfarra curta de recorde
    b = np.zeros(int(SR * .14)); place(b, add(sine(2200, .1, .018, .0008), noise_burst(.01, .003, .8) * .3), 0); save('sfx_check', b)
    b = np.zeros(int(SR * 1.5))
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]): place(b, add(sine(f, .5, .16, .004), sine(f * 2, .4, .12, .004, .4)), k * .1)
    place(b, add(bell(1046.5, 1.0, .4, .9), bell(1318.5, 1.0, .35, .6)), .4); save('sfx_record', b)

if __name__ == '__main__': build()
