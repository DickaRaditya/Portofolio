export const PROJECT_STATUSES = Object.freeze([
  Object.freeze({ value: 'ongoing', label: 'Ongoing' }),
  Object.freeze({ value: 'completed', label: 'Completed' }),
])

export function normalizeProjectStatus(value) {
  return PROJECT_STATUSES.some(status => status.value === value) ? value : 'completed'
}

export function projectStatusLabel(value) {
  const normalized = normalizeProjectStatus(value)
  return PROJECT_STATUSES.find(status => status.value === normalized).label
}

export function validateProjectStatus(value) {
  if (!PROJECT_STATUSES.some(status => status.value === value)) {
    throw new Error('Project status must be Ongoing or Completed.')
  }
  return value
}
