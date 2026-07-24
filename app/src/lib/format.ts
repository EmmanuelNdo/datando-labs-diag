export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}
