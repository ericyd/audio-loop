import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ButtonBase from '../ButtonBase'
import { Plus } from '../icons/Plus'
import { useKeyboard } from '../KeyboardProvider'
import { Track } from '../Track'

type Props = {
  clock: Worker
}

export const Scene: React.FC<Props> = ({ clock }) => {
  const keyboard = useKeyboard()
  const [tracks, setTracks] = useState([{ id: 1, selected: false }])
  const exportTarget = useMemo(() => new EventTarget(), [])

  function handleAddTrack() {
    setTracks((tracks) => [
      ...tracks,
      { id: Math.max(...tracks.map((t) => t.id)) + 1, selected: false },
    ])
  }

  function handleRemoveTrack(idToRemove: number) {
    return () => {
      // cannot remove last track
      if (tracks.length > 1) {
        setTracks((tracks) => tracks.filter(({ id }) => id !== idToRemove))
      }
    }
  }

  const setSelected = (selectedIndex: number) => (event: KeyboardEvent) => {
    if ('123456789'.includes(event.key)) {
      setTracks((tracks) =>
        tracks.map((track, i) => ({
          ...track,
          selected: i + 1 === selectedIndex,
        }))
      )
    }

    if (event.key === '0') {
      setTracks((tracks) =>
        tracks.map((track, i) => ({
          ...track,
          selected: i + 1 === 10,
        }))
      )
    }
  }

  /**
   * When called, exportTarget dispatches an event.
   * Tracks listen to this event and create a wav file blob from their audio buffer,
   * then download the file locally.
   */
  const handleExport = useCallback(() => {
    exportTarget.dispatchEvent(new Event('export'))
  }, [exportTarget])

  /**
   * Attach keyboard events
   */
  useEffect(() => {
    keyboard.on('a', 'Scene', handleAddTrack)
    for (let i = 0; i < 10; i++) {
      keyboard.on(String(i), `Scene ${i}`, setSelected(i))
    }
    return () => {
      keyboard.off('a', 'Scene')
      for (let i = 0; i < 10; i++) {
        keyboard.off(String(i), `Scene ${i}`)
      }
    }
  }, [keyboard, handleExport])

  return (
    <>
      {tracks.map(({ id, selected }) => (
        <Track
          key={id}
          id={id}
          selected={selected}
          onRemove={handleRemoveTrack(id)}
          clock={clock}
          exportTarget={exportTarget}
        />
      ))}
      <div className="my-8 flex justify-between items-end">
        <ButtonBase onClick={handleAddTrack} large>
          <Plus />
        </ButtonBase>
        <button
          onClick={handleExport}
          className="border border-zinc-400 border-solid rounded-full p-2 mr-2 hover:shadow-button"
        >
          Download stems
        </button>
      </div>
    </>
  )
}
