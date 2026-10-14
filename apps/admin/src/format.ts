export function formatTime(d: Date): string {
  return d.toLocaleTimeString('ta-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString('ta-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
