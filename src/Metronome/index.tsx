import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudioRouter } from '../AudioRouter'
import { ControlPanel } from '../ControlPanel'
import { Scene } from '../Scene'
import { ClockConsumerMessage } from '../worklets/ClockWorker'
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
  measureCount: number
  currentMeasure: number
  playing: boolean
  clock: Worker
  gain: number
  muted: boolean
}

export type MetronomeWriter = {
  setBpm: (bpm: number) => void
  setTimeSignature: (timeSignature: TimeSignature) => void
  setMeasureCount: (count: number) => void
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
  const [measureCount, setMeasureCount] = useState(2)
  const [playing, setPlaying] = useState(false)
  const [gain, setGain] = useState(0.5)
  const [muted, setMuted] = useState(false)

  /**
   * create 2 metronome beeps for different frequencies
   * I wanted to use useMemo so the `copyToChannel` calls could be made on creation,
   * but that requires a dependency array and really, these should never change
   */
  const sine330 = useRef(
    audioContext.createBuffer(
      1,
      // this should be the maximum length needed for the audio;
      // since this buffer is just holding a short sine wave, 1 second will be plenty
      audioContext.sampleRate,
      audioContext.sampleRate
    )
  )
  const sine380 = useRef(
    audioContext.createBuffer(
      1,
      audioContext.sampleRate,
      audioContext.sampleRate
    )
  )
  useEffect(() => {
    sine330.current.copyToChannel(
      decayingSine(sine330.current.sampleRate, 330),
      0
    )
    sine380.current.copyToChannel(
      decayingSine(sine380.current.sampleRate, 380),
      0
    )
  }, [])

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

  const clockMessageHandler = useCallback(
    (event: MessageEvent<ClockConsumerMessage>) => {
      // console.log(event.data) // this is really noisy
      if (event.data.message === 'tick') {
        const { currentTick } = event.data
        setCurrentTick(currentTick)

        // emit a "beep" noise for the metronome
        const source = new AudioBufferSourceNode(audioContext, {
          buffer: event.data.downbeat ? sine380.current : sine330.current,
        })

        gainNode.current.connect(audioContext.destination)
        source.connect(gainNode.current)
        source.start()
      }
    },
    [audioContext]
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
        measureCount,
        message: 'start',
      })

      setPlaying(true)
    }
  }

  useEffect(() => {
    clock.current.postMessage({
      bpm,
      beatsPerMeasure: timeSignature.beatsPerMeasure,
      measureCount,
      message: 'update',
    })
  }, [bpm, timeSignature.beatsPerMeasure, measureCount])

  const reader: MetronomeReader = {
    bpm,
    // we start at -1 to make the first beat work easily,
    // but we don't want to *show* -1 to the user
    currentTick: Math.max(currentTick % timeSignature.beatsPerMeasure, 0),
    timeSignature,
    measureCount,
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
    setMeasureCount,
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
