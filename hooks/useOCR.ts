import { useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

export type OCRStatus = 'idle' | 'initializing' | 'recognizing' | 'completed' | 'error';

export const useOCR = () => {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<OCRStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

  const performOCR = useCallback(async (image: File | string, languages: string = 'amh') => {
    try {
      setStatus('initializing');
      setStatusMessage('Initializing Tesseract...');
      setProgress(0);
      setResult(null);

      // Create worker with local language data path
      const worker = await createWorker(languages, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
            setStatusMessage(`Recognizing... ${Math.round(m.progress * 100)}%`);
          } else {
            setStatusMessage(m.status);
          }
        },
        langPath: '/tessdata', // Points to public/tessdata which we populated
        gzip: false, // Our local files are likely .traineddata (not .gz) unless we checked. 
                     // The user's files were .traineddata so gzip: false is correct.
      });

      setStatus('recognizing');
      const { data } = await worker.recognize(image);
      
      setResult(data.text);
      setConfidence(data.confidence);
      setStatus('completed');
      setStatusMessage('Done!');

      await worker.terminate();
      return data;
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage('Error occurred during OCR processing.');
    }
  }, []);

  return { performOCR, progress, status, statusMessage, result, confidence };
};
