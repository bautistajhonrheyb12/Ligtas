// Priority rescue: people who need help first. The database checks every rule
// again; these are for the forms and labels.
export const PRIORITY_CATEGORIES = ['pwd', 'pregnant', 'senior', 'child']

export const PRIORITY_ICONS = { pwd: 'accessible', pregnant: 'pregnant', senior: 'senior', child: 'child' }

// Staff screens are in English.
export const STAFF_LABELS = { pwd: 'PWD', pregnant: 'Pregnant', senior: 'Senior citizen', child: 'Child' }

// The proofs accepted for each category (photo or PDF).
export const PROOF_ACCEPT = 'image/*,application/pdf'

export const SENIOR_AGE = 60
export const CHILD_MAX_AGE = 17

export function ageFromBirthYear(birthYear) {
  return birthYear ? new Date().getFullYear() - Number(birthYear) : null
}

// ['senior', 'pwd', 'senior'] -> [['pwd', 1], ['senior', 2]] in the standard order.
export function countCategories(list = []) {
  return PRIORITY_CATEGORIES
    .map((category) => [category, list.filter((item) => item === category).length])
    .filter(([, count]) => count > 0)
}

// The form's checks, the same as the database's, so people see them before sending.
export function priorityFormProblem(draft, t) {
  const age = ageFromBirthYear(draft.birthYear)
  if (draft.fullName.trim().length < 2) return t('priorityErrName')
  if (draft.birthYear && (age < 0 || Number(draft.birthYear) < 1900)) return t('priorityErrBirthYear')
  if (draft.category === 'child' && (age === null || age > CHILD_MAX_AGE)) return t('priorityErrChild')
  if (draft.category === 'senior' && (age === null || age < SENIOR_AGE)) return t('priorityErrSenior')
  if (draft.category === 'pregnant' && !draft.dueDate) return t('priorityErrDueDate')
  if (!draft.proofFile && !draft.oldProofPath) return t('priorityErrProof')
  return ''
}
