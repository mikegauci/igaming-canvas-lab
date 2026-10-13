# Shared background music

`icl-background-loop.wav` was prepared from the user-supplied `icl-bg-audio-file.mp3`.

- Stereo, 48 kHz, 16-bit PCM; 1,382,400 frames (28.8 seconds).
- The source beat is 100 BPM: 48 beats end at 28.8 seconds. The remaining fade-out is removed.
- A 40 ms raised-cosine crossfade blends the outgoing audio at 28.8–28.84 seconds into
  the first 40 ms of the opening beat. The loop stays exactly 48 beats long.
- Lossless PCM avoids encoder delay or padding at the loop boundary.
- The lobby and games use the shared Web Audio player, at 28% music volume, with remembered
  independent music and effects mute settings, musical position, and pause/resume when changing
  pages or hiding the tab.
