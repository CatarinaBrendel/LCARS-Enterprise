
export default function toUiStatus(db) {
  switch (String(db || '').toLowerCase()) {
    case 'planned':      return 'NOT STARTED';
    case 'in_progress':  return 'IN PROGRESS';
    case 'hold':         return 'HOLD';
    case 'completed':    return 'DONE';
    case 'aborted':      return 'DONE'; // or 'ABORTED' if you support it
    default:             return String(db || '').toUpperCase();
  }
}