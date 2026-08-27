export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatFileKind(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "text/markdown":
      return "Markdown";
    case "text/plain":
      return "Text";
    default:
      return mimeType;
  }
}
