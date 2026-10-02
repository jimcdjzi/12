"""Original quiet piano miniature: melody, broken chords, soft bass, stereo room."""
from pathlib import Path
import wave
import numpy as np

RATE = 24000
BEAT = 60 / 66
BARS = 24
DURATION = BARS * 4 * BEAT
track = np.zeros((int((DURATION + 5) * RATE), 2), dtype=np.float64)

def note(midi, start, duration=2.6, velocity=.13, pan=0):
    t = np.arange(int(duration * RATE)) / RATE
    freq = 440 * 2 ** ((midi - 69) / 12)
    tone = sum(weight * np.sin(2*np.pi*freq*partial*t) * np.exp(-t*(1.1+partial*.28))
               for partial, weight in [(1,1),(2,.25),(3,.065),(4,.018)])
    tone *= (1-np.exp(-t*75)) * np.minimum(1,(duration-t)/.18) * velocity
    stereo = np.stack((tone*np.sqrt((1-pan)/2),tone*np.sqrt((1+pan)/2)),axis=1)
    index = int(start*RATE)
    track[index:index+len(t)] += stereo

chords = [(48,55,60,64,67),(45,52,57,60,64),(41,48,53,57,60),(43,50,55,59,62)]
melodies = [[76,74,72,67],[72,71,69,64],[69,72,76,74],[71,69,67,62],
            [72,76,79,76],[76,72,69,67],[69,67,65,69],[67,71,74,71]]
for bar in range(BARS):
    chord = chords[bar%4]
    base = bar*4*BEAT
    note(chord[0],base,3.5,.12,-.25)
    for j, index in enumerate([1,2,3,4,3,2,1,3]):
        note(chord[index],base+j*.5*BEAT,2.8,.07 if j%2 else .085,-.15)
    melody = melodies[bar%8]
    for j, pitch in enumerate(melody):
        note(pitch,base+(j+.12)*BEAT,3.3,.115 if j in [0,2] else .09,.22)

# A quiet, diffuse room tail; no sustained drone or sharp high harmonics.
dry = track.copy()
for delay, gain in [(.12,.13),(.23,.10),(.39,.065),(.61,.035)]:
    offset=int(delay*RATE)
    track[offset:] += dry[:-offset,::-1]*gain
length=int(DURATION*RATE)
audio=track[:length].copy()
tail=track[length:]
audio[:len(tail)] += tail
audio *= .76 / max(1, np.abs(audio).max())
pcm=(np.clip(audio,-1,1)*32767).astype('<i2')
out=Path(__file__).parent/'web/assets/moonlit-piano.wav'
with wave.open(str(out),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm.tobytes())
print(f'{out.name}: {DURATION:.1f}s original piano loop')
