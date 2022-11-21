import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudioRouter } from '../AudioRouter'
import { ControlPanel } from '../ControlPanel'
import { Scene } from '../Scene'
import type { ClockControllerMessage } from '../worklets/clock'
import { decayingSine } from './waveforms'

export type TimeSignature = {
  beatsPerMeasure: number
  // 4 = quarter note
  // 8 = eighth note
  // etc
  beatUnit: number
}

export type MetronomeReader = {
  bpm: number
  currentTick: number
  timeSignature: TimeSignature
  measuresPerLoop: number
  currentMeasure: number
  playing: boolean
  clock: Worker
  gain: number
  muted: boolean
}

export type MetronomeWriter = {
  setBpm: (bpm: number) => void
  setTimeSignature: (timeSignature: TimeSignature) => void
  setMeasuresPerLoop: (count: number) => void
  togglePlaying: () => Promise<void>
  setGain: (gain: number) => void
  setMuted: React.Dispatch<React.SetStateAction<boolean>>
}

type Props = {
  children?: React.ReactNode
}

export const Metronome: React.FC<Props> = () => {
  const { audioContext } = useAudioRouter()
  const [currentTick, setCurrentTick] = useState(-1)
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({
    beatsPerMeasure: 4,
    beatUnit: 4,
  })
  const [measuresPerLoop, setMeasuresPerLoop] = useState(2)
  const [playing, setPlaying] = useState(false)
  const [gain, setGain] = useState(0.5)
  const [muted, setMuted] = useState(false)

  /**
   * create 2 AudioBuffers with different frequencies,
   * to be used for the metronome beep.
   */
  const sine330 = useMemo(() => {
    const buffer = audioContext.createBuffer(
      1,
      // this should be the maximum length needed for the audio;
      // since this buffer is just holding a short sine wave, 1 second will be plenty
      audioContext.sampleRate,
      audioContext.sampleRate
    )
    buffer.copyToChannel(decayingSine(buffer.sampleRate, 330), 0)
    return buffer
  }, [audioContext])
  const sine380 = useMemo(() => {
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate,
      audioContext.sampleRate
    )
    buffer.copyToChannel(decayingSine(buffer.sampleRate, 380), 0)
    return buffer
  }, [audioContext])

  /**
   * Instantiate the clock worker.
   * This is truly the heartbeat of the entire app 🥹
   */
  const clock = useRef<Worker>(
    // Thanks SO! https://stackoverflow.com/a/71134400/3991555
    new Worker(new URL('../worklets/clock', import.meta.url))
  )

  /**
   * Set up metronome gain node.
   * See Track/index.tsx for description of the useRef/useEffect pattern
   */
  const gainNode = useRef(
    new GainNode(audioContext, { gain: muted ? 0.0 : gain })
  )
  useEffect(() => {
    gainNode.current.gain.value = muted ? 0.0 : gain
  }, [gain, muted])

  /**
   * On each tick, set the "currentTick" value and emit a beep.
   * The AudioBufferSourceNode must be created fresh each time,
   * because it can only be played once.
   */
  const clockMessageHandler = useCallback(
    (event: MessageEvent<ClockControllerMessage>) => {
      // console.log(event.data) // this is really noisy
      if (event.data.message === 'tick') {
        const { currentTick } = event.data
        setCurrentTick(currentTick)

        const source = new AudioBufferSourceNode(audioContext, {
          buffer: event.data.downbeat ? sine380 : sine330,
        })

        gainNode.current.connect(audioContext.destination)
        source.connect(gainNode.current)
        source.start()
      }
    },
    [audioContext, sine330, sine380]
  )

  useEffect(() => {
    clock.current.addEventListener('message', clockMessageHandler)
    // this is necessary to ensure the cleanup function has the correct reference
    const currentClock = clock.current
    return () => {
      currentClock.removeEventListener('message', clockMessageHandler)
    }
  }, [clockMessageHandler])

  async function togglePlaying() {
    if (playing) {
      await audioContext.suspend()
      clock.current.postMessage({
        message: 'stop',
      })
      setPlaying(false)
    } else {
      await audioContext.resume()
      clock.current.postMessage({
        bpm,
        beatsPerMeasure: timeSignature.beatsPerMeasure,
        measuresPerLoop,
        message: 'start',
      })
      setPlaying(true)
    }
  }

  useEffect(() => {
    clock.current.postMessage({
      bpm,
      beatsPerMeasure: timeSignature.beatsPerMeasure,
      measuresPerLoop,
      message: 'update',
    })
  }, [bpm, timeSignature.beatsPerMeasure, measuresPerLoop])

  const reader: MetronomeReader = {
    bpm,
    // we start at -1 to make the first beat work easily,
    // but we don't want to *show* -1 to the user
    currentTick: Math.max(currentTick % timeSignature.beatsPerMeasure, 0),
    timeSignature,
    measuresPerLoop,
    currentMeasure: Math.max(
      Math.floor(currentTick / timeSignature.beatsPerMeasure),
      0
    ),
    playing,
    clock: clock.current!,
    gain,
    muted,
  }
  const writer: MetronomeWriter = {
    setBpm,
    setTimeSignature,
    setMeasuresPerLoop,
    togglePlaying,
    setGain,
    setMuted,
  }
  return (
    <>
      <ControlPanel metronome={reader} metronomeWriter={writer} />
      <Scene metronome={reader} />
    </>
  )
}
