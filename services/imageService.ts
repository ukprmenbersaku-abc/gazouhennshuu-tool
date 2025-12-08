import { OutputFormat, ConversionSettings } from '../types';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const convertImage = async (
  file: File,
  settings: ConversionSettings
): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    try {
      const dataUrl = await readFileAsDataURL(file);
      const img = new Image();
      
      img.onload = () => {
        let targetWidth: number;
        let targetHeight: number;

        if (settings.resizeMode === 'scale') {
          targetWidth = Math.round(img.width * settings.scale);
          targetHeight = Math.round(img.height * settings.scale);
        } else {
          // px or cm mode
          let reqW = settings.width === '' ? null : Number(settings.width);
          let reqH = settings.height === '' ? null : Number(settings.height);

          // Convert CM to Pixels (Approx 96 DPI: 1cm = 37.795px)
          if (settings.resizeMode === 'cm') {
            const CM_TO_PX = 37.795;
            if (reqW !== null) reqW = reqW * CM_TO_PX;
            if (reqH !== null) reqH = reqH * CM_TO_PX;
          }

          if (settings.maintainAspectRatio) {
            if (reqW !== null && reqH !== null) {
              // Fit within box (contain)
              const scaleW = reqW / img.width;
              const scaleH = reqH / img.height;
              const scale = Math.min(scaleW, scaleH);
              targetWidth = Math.round(img.width * scale);
              targetHeight = Math.round(img.height * scale);
            } else if (reqW !== null) {
              targetWidth = Math.round(reqW);
              targetHeight = Math.round(img.height * (reqW / img.width));
            } else if (reqH !== null) {
              targetHeight = Math.round(reqH);
              targetWidth = Math.round(img.width * (reqH / img.height));
            } else {
              targetWidth = img.width;
              targetHeight = img.height;
            }
          } else {
            // Stretch / Ignore aspect ratio
            targetWidth = reqW !== null ? Math.round(reqW) : img.width;
            targetHeight = reqH !== null ? Math.round(reqH) : img.height;
          }
        }

        // Safety check for 0 dimensions
        targetWidth = Math.max(1, targetWidth);
        targetHeight = Math.max(1, targetHeight);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill background with white for transparent images if converting to JPEG
        if (settings.format === OutputFormat.JPEG) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Enable high quality image scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Conversion failed'));
            }
          },
          settings.format,
          settings.quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    } catch (e) {
      reject(e);
    }
  });
};

export const getExtensionFromMime = (mime: OutputFormat): string => {
  switch (mime) {
    case OutputFormat.JPEG: return 'jpg';
    case OutputFormat.PNG: return 'png';
    case OutputFormat.WEBP: return 'webp';
    default: return 'jpg';
  }
};