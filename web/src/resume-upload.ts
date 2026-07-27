const supportedPdfMimeTypes = new Set(["", "application/pdf", "application/octet-stream"]);

export function isSupportedResumeMetadata(file: { name: string; type: string }): boolean {
  return file.name.toLowerCase().endsWith(".pdf") && supportedPdfMimeTypes.has(file.type);
}
