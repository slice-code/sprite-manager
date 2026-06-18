import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileWarning, ClipboardCopy } from 'lucide-react';
import { sortFilesByNumericName } from '../utils/fileSort';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void | Promise<void>;
  uploading?: boolean;
}

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VALID_EXT = /\.(png|jpe?g|webp)$/i;

function isValidImageFile(file: File): boolean {
  return VALID_TYPES.includes(file.type) || VALID_EXT.test(file.name);
}

export default function UploadZone({ onFilesSelected, uploading = false }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await processFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [uploading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setErrorLog(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorLog(null);
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    if (uploading) return;

    const filteredFiles = sortFilesByNumericName(files.filter(isValidImageFile));

    if (filteredFiles.length === 0) {
      setErrorLog('No valid PNG, JPG, or WEBP images detected.');
      return;
    }

    setErrorLog(null);
    await onFilesSelected(filteredFiles);
  };

  const triggerSelect = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`relative cursor-pointer border-2 border-dashed rounded-xl p-8 flex flex-col items-center text-center justify-center min-h-[170px] transition-all focus:outline-none ${
          uploading
            ? 'opacity-60 pointer-events-none border-slate-700 bg-slate-900/30'
            : isDragActive
              ? 'border-indigo-400 bg-indigo-950/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
              : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900/90'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <UploadCloud className={`w-10 h-10 ${isDragActive ? 'text-indigo-400 animate-bounce' : 'text-slate-500'} mb-3`} />

        <p className="text-sm font-semibold text-slate-200">
          {uploading ? 'Uploading…' : (
            <>Drag & Drop files here, or <span className="text-indigo-400 hover:underline">browse files</span></>
          )}
        </p>

        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <ClipboardCopy className="w-3 h-3 text-emerald-400" />
          Supports keyboard <kbd className="bg-slate-800 text-[10px] px-1 py-0.5 rounded text-slate-300">Ctrl+V</kbd> paste anywhere on page
        </p>

        <span className="text-[10px] text-slate-500 mt-3 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
          Accepts: PNG, JPG, or WEBP — auto-sorted by number in filename (e.g. 0001.png, 0033.png)
        </span>
      </div>

      {errorLog && (
        <div className="bg-rose-950/50 border border-rose-800/40 text-rose-200 text-xs p-3.5 rounded-lg flex gap-2.5 items-start">
          <FileWarning className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">Grid Upload Error</span>
            <p className="opacity-90">{errorLog}</p>
          </div>
        </div>
      )}
    </div>
  );
}
