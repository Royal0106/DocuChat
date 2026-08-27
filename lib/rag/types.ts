export interface EvidenceItem {
  evidenceId: string;
  chunkId: string;
  filename: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  excerpt: string;
  score: number;
}

export interface SearchDocumentToolOutput {
  evidence: EvidenceItem[];
}
