import { useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FileType, AlertCircle } from 'lucide-react';

interface DropzoneProps {
    onFileAccepted: (file: File) => void;
    isLoading: boolean;
}

export function Dropzone({ onFileAccepted, isLoading }: DropzoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileAccepted(acceptedFiles[0]);
        }
    }, [onFileAccepted]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.webp'],
        },
        maxFiles: 1,
        disabled: isLoading
    });

    return (
        <div
            {...getRootProps()}
            className={`relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out cursor-pointer overflow-hidden
        ${isDragActive
                    ? 'border-indigo-500 bg-indigo-50/10 scale-[1.02] shadow-xl'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-900'}
        ${isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
      `}
        >
            <input {...getInputProps()} />
            <div className="relative z-10 flex flex-col items-center justify-center gap-4 text-center">
                <div className={`p-4 rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3
          ${isDragActive ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Upload className={`w-8 h-8 
            ${isDragActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                <div className="space-y-2">
                    <p className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                        {isDragActive ? "Drop to analyze" : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Optimized for Amharic Documents • Images (PNG, JPG)
                    </p>
                </div>
            </div>

            {/* Decorative background gradients */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-indigo-500/5 dark:to-indigo-400/5 pointer-events-none" />
        </div>
    );
}
