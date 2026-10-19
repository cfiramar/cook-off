/**
 * ImageOptimizerService
 * Encapsulates client-side image compression and aspect ratio calculations
 * to provide lightweight, mobile-optimized images for voting mode.
 */

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  format?: 'image/webp' | 'image/jpeg';
}

export class ImageOptimizerService {
  /**
   * Calculates aspect-ratio preserving dimensions without exceeding maxWidth or maxHeight.
   * Does not upscale images that are already smaller than the constraints.
   */
  public static calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth = 800,
    maxHeight?: number
  ): { width: number; height: number } {
    if (originalWidth <= 0 || originalHeight <= 0) {
      return { width: Math.max(1, originalWidth), height: Math.max(1, originalHeight) };
    }

    let width = originalWidth;
    let height = originalHeight;

    // Scale down width if needed
    if (maxWidth && width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    // Scale down height if needed
    if (maxHeight && height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    return {
      width: Math.max(1, width),
      height: Math.max(1, height)
    };
  }

  /**
   * Generates a lightweight, compressed copy of an uploaded image.
   * Default target: 800px max width, WebP format, 80% quality (~80-100KB).
   * 
   * @param file Original image file from file picker
   * @param options Custom resize options
   * @returns Compressed File instance or original file if compression is unsupported
   */
  public static async createLightweightCopy(
    file: File,
    options: ResizeOptions = {}
  ): Promise<File> {
    const maxWidth = options.maxWidth ?? 800;
    const quality = options.quality ?? 0.8;
    const format = options.format ?? 'image/webp';

    // In non-browser environments or if canvas is unavailable, return original file
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const { width, height } = ImageOptimizerService.calculateDimensions(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            maxWidth,
            options.maxHeight
          );

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const extension = format === 'image/webp' ? 'webp' : 'jpg';
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const lowResFile = new File([blob], `${baseName}_mobile.${extension}`, {
                type: format,
                lastModified: Date.now()
              });
              resolve(lowResFile);
            },
            format,
            quality
          );
        } catch (error) {
          console.warn('Image optimization canvas error:', error);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  }
}
