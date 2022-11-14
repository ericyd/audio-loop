import { TimeSignature as TimeSignatureType } from '../Metronome'
import ControlPanelItem from './ControlPanelItem'

type TimeSignatureProps = {
  onChange(signature: TimeSignatureType): void
  beatsPerMeasure: number
  beatUnit: number
}
export default function TimeSignature(props: TimeSignatureProps) {
  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const [beatsPerMeasureStr, beatUnitStr] = event.target.value?.split('/')
    if (!beatsPerMeasureStr || !beatUnitStr) {
      throw new Error(`Could not parse time signature "${event.target.value}"`)
    }
    const [beatsPerMeasure, beatUnit] = [
      Number(beatsPerMeasureStr),
      Number(beatUnitStr),
    ]
    if (Number.isNaN(beatsPerMeasure) || Number.isNaN(beatUnit)) {
      throw new Error(
        `Could not convert time signature "${event.target.value}" to numeric values`
      )
    }
    props.onChange({
      beatsPerMeasure,
      beatUnit,
    })
  }

  return (
    <ControlPanelItem>
      <select
        onChange={handleChange}
        value={`${props.beatsPerMeasure}/${props.beatUnit}`}
        className="font-serif text-4xl bg-white"
      >
        <option value="4/4">4/4</option>
        <option value="7/8">7/8</option>
      </select>
    </ControlPanelItem>
  )
}
