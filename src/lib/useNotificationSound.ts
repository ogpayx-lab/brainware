'use client'
import { useEffect, useRef, useCallback } from 'react'

/**
 * Cash register "ka-ching!" sound using Web Audio API.
 * Simulates the classic cash drawer opening sound.
 */
export function playCashSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime

    // --- Part 1: Initial "ka" click (metallic tap) ---
    const clickOsc = ctx.createOscillator()
    const clickGain = ctx.createGain()
    clickOsc.connect(clickGain)
    clickGain.connect(ctx.destination)
    clickOsc.type = 'square'
    clickOsc.frequency.setValueAtTime(1800, t)
    clickOsc.frequency.exponentialRampToValueAtTime(600, t + 0.04)
    clickGain.gain.setValueAtTime(0.2, t)
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    clickOsc.start(t)
    clickOsc.stop(t + 0.06)

    // --- Part 2: "Ching" bell ring (bright metallic) ---
    const bellFreqs = [2637, 3520, 4186] // E7, A7, C8 — bright bell chord
    bellFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t + 0.06)
      gain.gain.linearRampToValueAtTime(0.12 - i * 0.02, t + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t + 0.06)
      osc.stop(t + 0.6)
    })

    // --- Part 3: Second "ching" echo (slightly higher, softer) ---
    const echo = ctx.createOscillator()
    const echoGain = ctx.createGain()
    echo.connect(echoGain)
    echoGain.connect(ctx.destination)
    echo.type = 'sine'
    echo.frequency.value = 3135 // G7
    echoGain.gain.setValueAtTime(0, t + 0.18)
    echoGain.gain.linearRampToValueAtTime(0.08, t + 0.2)
    echoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
    echo.start(t + 0.18)
    echo.stop(t + 0.7)

    // --- Part 4: Cash drawer slide noise (white noise burst) ---
    const bufferSize = ctx.sampleRate * 0.12
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      channel[i] = (Math.random() * 2 - 1) * 0.08
    }
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const noiseFilter = ctx.createBiquadFilter()
    noise.buffer = buffer
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 4000
    noiseGain.gain.setValueAtTime(0.15, t + 0.03)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    noise.start(t + 0.03)
    noise.stop(t + 0.15)

    setTimeout(() => ctx.close(), 1200)
  } catch {
    // Web Audio not supported
  }
}

/**
 * Simple notification beep
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime

    // Two-tone ascending beep
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.type = 'sine'
    osc1.frequency.value = 880
    gain1.gain.setValueAtTime(0.12, t)
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc1.start(t)
    osc1.stop(t + 0.15)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.type = 'sine'
    osc2.frequency.value = 1318 // E6
    gain2.gain.setValueAtTime(0.12, t + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc2.start(t + 0.15)
    osc2.stop(t + 0.35)

    setTimeout(() => ctx.close(), 800)
  } catch {}
}
