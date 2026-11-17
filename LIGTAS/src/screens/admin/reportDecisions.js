// The questions asked before an admin changes a report in a way that is hard
// to undo. Shared by the dashboard's "Needs review" list and the Reports page.

export const REJECT_REASONS = [
  'Duplicate of another report',
  'Not enough details to act on',
  'Outside the service area',
  'Already handled',
  'Not an emergency',
]

export const RESOLVE_NOTES = [
  'Help has arrived',
  'The situation is under control',
  'Handled by another agency',
  'Duplicate of another report',
]

const kind = (report) => (report.report_type === 'SOS' ? 'SOS' : `${report.report_type.toLowerCase()} report`)

export function rejectQuestion(report) {
  return {
    title: `Reject this ${kind(report)}?`,
    message: `${report.location}. The citizen sees the reason on their report, and no rescuer is sent.`,
    confirmLabel: 'Reject report',
    reasons: REJECT_REASONS,
    reasonLabel: 'Reason shown to the citizen',
    otherPlaceholder: 'For example: the photo shows a different place',
    icon: 'x',
  }
}

// What changing a report's status does, and the change to send.
export function statusQuestion(report, status) {
  if (status === 'Rejected') return { ask: rejectQuestion(report), changes: (reason) => ({ status, resolution_note: reason }) }
  if (status === 'Resolved') {
    return {
      ask: {
        title: `Mark this ${kind(report)} resolved?`,
        message: 'It leaves the rescuers\' open queue and the citizen sees it as resolved.',
        confirmLabel: 'Mark resolved',
        tone: 'primary',
        reasons: RESOLVE_NOTES,
        reasonLabel: 'Note shown to the citizen',
        otherPlaceholder: 'What was done',
        icon: 'check',
      },
      changes: (note) => ({ status, resolution_note: note }),
    }
  }
  if (status === 'Pending') {
    return {
      ask: {
        title: `Send this ${kind(report)} back to review?`,
        message: report.assigned_to ? 'The assigned team is taken off the call, and rescuers stop seeing it until it is verified again.' : 'Rescuers stop seeing it until it is verified again.',
        confirmLabel: 'Send back to review',
        tone: 'warning',
        icon: 'history',
      },
      changes: () => ({ status }),
    }
  }
  return {
    ask: {
      title: `Reopen this ${kind(report)} as verified?`,
      message: 'Rescuers see it again in their open queue, and the earlier note is cleared.',
      confirmLabel: 'Reopen',
      tone: 'primary',
      icon: 'refresh',
    },
    changes: () => ({ status }),
  }
}

// Only taking a team off a call, or moving it to another team, is asked.
export function assignQuestion(report, nextTeamId, teamName) {
  if (!report.assigned_to || report.assigned_to === nextTeamId) return null
  return nextTeamId
    ? {
      title: `Move this call to ${teamName(nextTeamId)}?`,
      message: `${teamName(report.assigned_to)} is taken off the call (now ${report.response_stage ?? 'Assigned'}), and ${teamName(nextTeamId)} starts from Assigned.`,
      confirmLabel: 'Move call',
      tone: 'warning',
      icon: 'users',
    }
    : {
      title: `Take ${teamName(report.assigned_to)} off this call?`,
      message: 'The call goes back to the open queue with no team.',
      confirmLabel: 'Unassign team',
      tone: 'warning',
      icon: 'users',
    }
}
