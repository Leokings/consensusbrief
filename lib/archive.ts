export type ArchiveBriefItem = {
  id: string;
  shareSlug: string;
  title: string;
  summary: string;
  resultWordCount: number;
  createdAt: string;
};

export type ArchiveResponse = {
  wallet: string;
  briefs: ArchiveBriefItem[];
};
