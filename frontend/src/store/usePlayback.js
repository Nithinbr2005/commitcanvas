import { create } from 'zustand'

export const usePlayback = create((set) => ({
  playing: false,
  time: 0,
  speed: 1,
  duration: 1,
  setPlaying: (p) => set({ playing: p }),
  setTime: (t) => set({ time: t }),
  setSpeed: (s) => set({ speed: s }),
  setDuration: (d) => set({ duration: d }),
}))
