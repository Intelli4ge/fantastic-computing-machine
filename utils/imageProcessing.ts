/**
 * Image Processing Utilities for Amharic OCR
 * Implements advanced preprocessing techniques including:
 * - Grayscale Conversion (Weighted)
 * - Adaptive Thresholding (Integral Image approach for speed)
 * - Noise Reduction (Median Filter)
 * - Upscaling
 */

interface PreprocessOptions {
    grayscale?: boolean;
    binarize?: boolean; // If true, applies Adaptive Thresholding
    denoise?: boolean;  // If true, applies Median Blur
    upscale?: boolean;  // If true, scales small images to 300 DPI equiv
}

/**
 * Computes the integral image (summed-area table) for fast local mean extraction.
 */
function computeIntegralImage(data: Uint8ClampedArray, width: number, height: number): Int32Array {
    const integral = new Int32Array(width * height);

    for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            // We assume data is already 1-channel grayscale or we take the first channel
            sum += data[i * 4];
            if (y === 0) {
                integral[i] = sum;
            } else {
                integral[i] = integral[(y - 1) * width + x] + sum;
            }
        }
    }
    return integral;
}

/**
 * Applies Adaptive Thresholding using the Integral Image method.
 * This is equivalent to cv2.adaptiveThreshold with ADAPTIVE_THRESH_MEAN_C
 */
function applyAdaptiveThreshold(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    windowSize: number = 21, // ~2% of width often works well, or fixed ~15 px for text
    constant: number = 10    // The C value in OpenCV
) {
    const integral = computeIntegralImage(data, width, height);
    const output = new Uint8ClampedArray(data.length);
    const halfWindow = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x1 = Math.max(x - halfWindow, 0);
            const y1 = Math.max(y - halfWindow, 0);
            const x2 = Math.min(x + halfWindow, width - 1);
            const y2 = Math.min(y + halfWindow, height - 1);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            // I(D) + I(A) - I(B) - I(C)
            // A=(x1-1, y1-1), B=(x2, y1-1), C=(x1-1, y2), D=(x2, y2)
            // Indices handling edge cases

            const A = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * width + (x1 - 1)] : 0;
            const B = (y1 > 0) ? integral[(y1 - 1) * width + x2] : 0;
            const C = (x1 > 0) ? integral[y2 * width + (x1 - 1)] : 0;
            const D = integral[y2 * width + x2];

            const sum = D + A - B - C;
            const mean = sum / count;

            const idx = (y * width + x) * 4;
            const value = data[idx];

            // Thresholding
            const binary = value > (mean - constant) ? 255 : 0;

            output[idx] = binary;     // R
            output[idx + 1] = binary; // G
            output[idx + 2] = binary; // B
            output[idx + 3] = 255;    // Alpha
        }
    }

    // Replace original data
    data.set(output);
}

/**
 * Applies a simple 3x3 Median Filter to remove salt-and-pepper noise
 */
function applyMedianFilter(data: Uint8ClampedArray, width: number, height: number) {
    const copy = new Uint8ClampedArray(data); // Work on copy to avoid reading modified values

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // Gather 3x3 neighborhood
            const neighbors = [];
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    neighbors.push(copy[idx]); // Read Reduced Grayscale value
                }
            }

            // Sort and pick median
            neighbors.sort((a, b) => a - b);
            const median = neighbors[4];

            const i = (y * width + x) * 4;
            data[i] = median;
            data[i + 1] = median;
            data[i + 2] = median;
            // data[i+3] (Alpha) remains
        }
    }
}

export const preprocessImage = (imageFile: File, options: PreprocessOptions = {}): Promise<string> => {
    // Default Options
    const config = {
        grayscale: true,
        binarize: true, // Default to Adaptive Threshold
        denoise: false, // Median filter is expensive, opt-in
        upscale: true,
        ...options
    };

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.src = url;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Upscaling logic (Crucial for Tesseract accuracy on small text)
            if (config.upscale && (width < 1500 || height < 1500)) {
                const scale = 2; // Simple 2x upscale
                width *= scale;
                height *= scale;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(url); // Fail safe
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 1. Grayscale Conversion
            if (config.grayscale || config.binarize) {
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    // Luminance weighted average
                    const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
            }

            // 2. Denoise (Median Filter) - Done before thresholding to smooth noise
            // Note: This is computationally expensive in JS (O(W*H)). 
            // Only enable if noise is significant.
            if (config.denoise) {
                applyMedianFilter(data, width, height);
            }

            // 3. Adaptive Thresholding
            if (config.binarize) {
                // Window size roughly translates to the size of "shadows" we want to ignore.
                // For text, a window of ~20-30px (after upscaling) is usually good to isolate letters from local background.
                // Constant C is how much darker usage must be than local avg.
                applyAdaptiveThreshold(data, width, height, 41, 15);
            }

            ctx.putImageData(imageData, 0, 0);

            const processedUrl = canvas.toDataURL('image/png');
            resolve(processedUrl);
            URL.revokeObjectURL(url);
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
    });
};
