export interface ImageBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  name?: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}
