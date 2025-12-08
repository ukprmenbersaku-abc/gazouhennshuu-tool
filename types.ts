export enum OutputFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface ProcessedFile {
  id: string;
  originalFile: File;
  previewUrl: string;
  status: ProcessStatus;
  outputBlob?: Blob;
  newName?: string; // Base name without extension
  error?: string;
}

export type ResizeMode = 'scale' | 'px' | 'cm';

export interface ConversionSettings {
  format: OutputFormat;
  quality: number; // 0 to 1
  
  // Resize Settings
  resizeMode: ResizeMode;
  scale: number; // 0.1 to 1
  width: number | ''; // px or cm value
  height: number | ''; // px or cm value
  maintainAspectRatio: boolean;

  baseFilename: string;
  useSequentialNumbering: boolean;
}