'use client';

import { useState, useEffect } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { useOCR } from '@/hooks/useOCR';
import { preprocessImage } from '@/utils/imageProcessing';
import { Copy, Check, Loader2, Sparkles, Wand2, Download, Trash2, Settings, Languages, ScanLine, FileText } from 'lucide-react';

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { performOCR, progress, status, statusMessage, result, confidence } = useOCR();
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Options
  const [useEnglish, setUseEnglish] = useState(false);
  const [usePreprocessing, setUsePreprocessing] = useState(true);

  useEffect(() => {
    if (result) setEditableText(result);
  }, [result]);

  const handleFile = async (file: File) => {
    // Reset states
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setEditableText('');

    // Default preview is the original file
    let previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    let inputForOCR: File | string = file;

    // Preprocessing Step
    if (usePreprocessing) {
      // We process immediately to show the user what the machine sees
      // This might overwrite the preview with the B&W version
      try {
        const processed = await preprocessImage(file, { grayscale: true, binarize: true });
        // Update preview to show the processed version (optional, but good for trust)
        // If processed is a data URL string
        if (typeof processed === 'string') {
          // For UX, maybe update the preview to show the "Cleaned" version
          setPreview(processed);
          inputForOCR = processed;
        }
      } catch (e) {
        console.error("Preprocessing failed, falling back to original", e);
      }
    }

    const langs = useEnglish ? 'amh+eng' : 'amh';
    performOCR(inputForOCR, langs);
  };

  const handleClear = () => {
    if (preview && !preview.startsWith('data:')) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    setEditableText('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([editableText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "amharic_ocr_result.txt";
    document.body.appendChild(element);
    element.click();
  };

  const handleSaveToServer = async () => {
    if (!editableText) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/upload-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_UPLOAD_API_KEY || '',
        },
        body: JSON.stringify({
          text: editableText,
          metadata: {
            confidence,
            timestamp: new Date().toISOString(),
            source: 'web-client'
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = status === 'initializing' || status === 'recognizing';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500/30 font-sans">

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-violet-700 dark:from-indigo-400 dark:to-violet-400">
              Amharic OCR
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Client-Side Processing</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Left Column: Input / Image */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[600px] flex flex-col">

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Document Source
                </h2>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseEnglish(!useEnglish)}
                    className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${useEnglish ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700'}`}
                  >
                    <Languages className="w-3 h-3" />
                    Amharic {useEnglish && '+ English'}
                  </button>

                  <button
                    onClick={() => setUsePreprocessing(!usePreprocessing)}
                    className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${usePreprocessing ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700'}`}
                    title="Enhance image contrast and remove noise before OCR"
                  >
                    <Wand2 className="w-3 h-3" />
                    Enhance: {usePreprocessing ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              {!preview ? (
                <div className="flex-1 flex flex-col justify-center">
                  <Dropzone onFileAccepted={handleFile} isLoading={isLoading} />
                  <div className="mt-8 text-center text-sm text-slate-400">
                    <p>Supports drag & drop or click to upload.</p>
                    <p>Privacy First: Images are processed locally in your browser.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-black/50 flex-1 flex items-center justify-center min-h-[400px]">
                    {/* Blur Image Background */}
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl"
                      style={{ backgroundImage: `url(${preview})` }}
                    />

                    {/* Main Image */}
                    <img
                      src={preview}
                      alt="Uploaded content"
                      className="relative max-w-full max-h-[500px] object-contain shadow-lg"
                    />

                    {/* Loading Overlay */}
                    {isLoading && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 text-center">
                        <div className="relative mb-4">
                          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                          <div className="w-16 h-16 flex items-center justify-center font-bold text-indigo-600">
                            {Math.round(progress * 100)}%
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 animate-pulse">
                          {statusMessage || 'Processing...'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-2 max-w-xs">
                          Running neural network models on your device...
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <button
                      onClick={handleClear}
                      disabled={isLoading}
                      className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Reset
                    </button>

                    {confidence > 0 && !isLoading && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">Confidence:</span>
                        <span className={`font-bold ${confidence > 80 ? 'text-green-600' : 'text-amber-600'}`}>
                          {confidence.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[600px] flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-500" />
                  Extracted Text
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={!editableText}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 disabled:opacity-50"
                    title="Download .txt"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSaveToServer}
                    disabled={!editableText || isSaving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${saveStatus === 'success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : saveStatus === 'error'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none'}`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveStatus === 'success' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved' : saveStatus === 'error' ? 'Failed' : 'Save to Server'}
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!editableText || isSaving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${copied
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50'}`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="relative flex-1">
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  placeholder={isLoading ? "Analyzing document structure and extracting text..." : "Upload an image to see results here."}
                  className="absolute inset-0 w-full h-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-black/20 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none font-sans text-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  spellCheck={false}
                  dir="auto" // Auto direction for RTL/LTR support (Amharic handles it well usually, but clean to have)
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
