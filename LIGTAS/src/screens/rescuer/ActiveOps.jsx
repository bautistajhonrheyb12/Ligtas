import { useState } from 'preact/hooks'
import { Icon, timeAgo } from '../../lib/ui.jsx'
import { CallCard, ResponseSteps } from './CallCard.jsx'

const QUICK_NOTES = ['Arrived, assessing', 'Need more personnel', 'Need a boat', 'Need an ambulance', 'Road impassable, rerouting', 'Evacuating residents']

// Field notes on one call: the log so far (oldest first) and a box to add one.
export function FieldNotes({ call, notes, staffName, myId, canAdd, onAdd }) {
  const [text, setText] = useState('')
  // The form opens on request, so the call's next step stays near the top.
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    const note = text.replace(/\s+/g, ' ').trim()
    if (note.length < 2) {
      setError('Write the note first.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAdd(call.id, note)
      setText('')
      setIsAdding(false)
    } catch (addError) {
      setError(addError.message)
    } finally {
      setSaving(false)
    }
  }
  return <section class="rx-notes" aria-label="Field notes">
    <h4><Icon name="file" size={15} /> Field notes <small>{notes.length ? `${notes.length}` : ''}</small></h4>
    {notes.length > 0
      ? <ol class="rx-notes-list">
        {notes.map((note) => <li key={note.id}>
          <p>{note.detail}</p>
          <small>{note.actor_id === myId ? 'You' : staffName(note.actor_id)} · {timeAgo(note.created_at).toLowerCase()}</small>
        </li>)}
      </ol>
      : <p class="rx-notes-empty">No notes yet. Operations sees each note as soon as it is saved.</p>}
    {canAdd && !isAdding && <button type="button" class="rx-chip-button rx-notes-add" onClick={() => setIsAdding(true)}><Icon name="plus" size={15} /> Add a field note</button>}
    {canAdd && isAdding && <form class="rx-notes-form" onSubmit={submit}>
      <div class="rx-quick-notes">
        {QUICK_NOTES.map((quick) => <button type="button" key={quick} onClick={() => { setText((current) => (current ? `${current}. ${quick}` : quick)); setError('') }}>{quick}</button>)}
      </div>
      <div class="rx-notes-input">
        <textarea rows="2" maxLength="500" value={text} placeholder="What is happening on scene?" aria-label="Field note for this call" autoFocus onInput={(event) => { setText(event.currentTarget.value); if (error) setError('') }} />
        <button type="submit" class="rx-btn rx-btn--accent" disabled={saving}>{saving ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="send" size={16} />} Save note</button>
      </div>
      <button type="button" class="rx-link-button rx-link-button--muted" disabled={saving} onClick={() => { setIsAdding(false); setText(''); setError('') }}>Cancel</button>
      {error && <p class="rx-inline-error" role="alert"><Icon name="alert" size={14} /> {error}</p>}
    </form>}
  </section>
}

// Ongoing assignments: each with its progress, the details that matter on the
// way, the next step, and the field notes.
export function ActiveOps({ calls, loading, myId, myPosition, integrity, staffName, notesFor, renderActions, onAddNote, onShowOnMap, onGoToCalls }) {
  if (loading) return null
  if (!calls.length) {
    return <div class="rx-empty">
      <span class="rx-empty-icon"><Icon name="navigate" size={28} /></span>
      <strong>No active operation</strong>
      <p>Calls you take, or that operations assigns to you, appear here with their progress and field notes.</p>
      <button type="button" class="rx-btn rx-btn--accent" onClick={onGoToCalls}><Icon name="calls" size={18} /> See open calls</button>
    </div>
  }
  return <div class="rx-call-list">
    {calls.map((call) => <CallCard
      key={call.id}
      report={call}
      myId={myId}
      myPosition={myPosition}
      isTampered={integrity[call.id] === 'tampered'}
      staffName={staffName}
      onShowOnMap={onShowOnMap}
      actions={renderActions(call)}
      showSteps={false}
      footer={<FieldNotes call={call} notes={notesFor(call.id) ?? []} staffName={staffName} myId={myId} canAdd onAdd={onAddNote} />}
    >
      <div class="rx-active-progress">
        <ResponseSteps report={call} />
        {call.assigned_at && <small>Accepted {timeAgo(call.assigned_at).toLowerCase()} · requested {timeAgo(call.created_at).toLowerCase()}</small>}
      </div>
    </CallCard>)}
  </div>
}
