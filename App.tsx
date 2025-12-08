import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { Play, Trash2, Settings, RefreshCcw, FileArchive, Files as FilesIcon, CheckSquare, Square, Maximize2, TextCursorInput, Hash, Check } from 'lucide-react';

import Header from './components/Header';
import FileDropzone from './components/FileDropzone';
import FileItem from './components/FileItem';
import Button from './components/Button';

import { ProcessedFile, ProcessStatus, OutputFormat, ConversionSettings, ResizeMode } from './types';
import { convertImage, getExtensionFromMime } from './services/imageService';
import { translations, Language } from './utils/translations';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<ConversionSettings>({
    format: OutputFormat.JPEG,
    quality: 0.9,
    resizeMode: 'scale',
    scale: 1.0,
    width: '',
    height: '',
    maintainAspectRatio: true,
    baseFilename: '',
    useSequentialNumbering: false,
  });
  const [language, setLanguage] = useState<Language>('ja');
  const t = translations[language];

  // Handle file selection
  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const processedFiles: ProcessedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      originalFile: file,
      previewUrl: URL.createObjectURL(file),
      status: ProcessStatus.IDLE,
    }));
    setFiles(prev => [...prev, ...processedFiles]);
  }, []);

  // Selection Logic
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => f.id)));
    }
  };

  // Remove a single file
  const handleRemoveFile = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // Cleanup
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return newFiles;
    });
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Clear all files
  const handleClearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setSelectedIds(new Set());
  };

  // Main processing logic
  const startProcessing = async () => {
    setIsProcessing(true);
    const newFiles = [...files];

    // Reset errors
    newFiles.forEach(f => {
       if (f.status === ProcessStatus.ERROR) f.status = ProcessStatus.IDLE;
    });

    // To keep numbering consistent across the entire list (even if we skip completed ones),
    // we calculate the name based on the index in the full array.
    await Promise.all(newFiles.map(async (fileItem, index) => {
      if (fileItem.status === ProcessStatus.COMPLETED) return;

      setFiles(current => 
        current.map(f => f.id === fileItem.id ? { ...f, status: ProcessStatus.PROCESSING } : f)
      );

      try {
        // Renaming Logic
        const originalBase = fileItem.originalFile.name.split('.').slice(0, -1).join('.');
        let baseName = settings.baseFilename.trim();

        // If empty, use original name
        if (!baseName) {
          baseName = originalBase;
        }

        // Sequential Numbering: Name_1, Name_2, etc.
        if (settings.useSequentialNumbering) {
          baseName = `${baseName}_${index + 1}`;
        }

        const blob = await convertImage(
          fileItem.originalFile, 
          settings
        );

        setFiles(current => 
          current.map(f => f.id === fileItem.id ? { 
            ...f, 
            status: ProcessStatus.COMPLETED, 
            outputBlob: blob,
            newName: baseName
          } : f)
        );
      } catch (error) {
        setFiles(current => 
          current.map(f => f.id === fileItem.id ? { 
            ...f, 
            status: ProcessStatus.ERROR, 
            error: error instanceof Error ? error.message : t.statusFailed
          } : f)
        );
      }
    }));

    setIsProcessing(false);
  };

  // Generic Download Function
  const handleDownloadFiles = async (targetFiles: ProcessedFile[], mode: 'zip' | 'raw') => {
    const readyFiles = targetFiles.filter(f => f.status === ProcessStatus.COMPLETED && f.outputBlob);
    if (readyFiles.length === 0) return;

    if (mode === 'zip') {
      const zip = new JSZip();
      readyFiles.forEach(file => {
        if (file.outputBlob) {
          const ext = getExtensionFromMime(settings.format);
          const fileName = `${file.newName}.${ext}`;
          zip.file(fileName, file.outputBlob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      FileSaver.saveAs(content, `pixmorph_converted_${Date.now()}.zip`);
    } else {
      // Raw files
      for (let i = 0; i < readyFiles.length; i++) {
        const file = readyFiles[i];
        if (file.outputBlob) {
          const ext = getExtensionFromMime(settings.format);
          const fileName = `${file.newName}.${ext}`;
          FileSaver.saveAs(file.outputBlob, fileName);
          // Small delay to prevent browser blocking multiple downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
  };

  // Download handlers wrapper
  const onDownloadSelected = (mode: 'zip' | 'raw') => {
    const selected = files.filter(f => selectedIds.has(f.id));
    handleDownloadFiles(selected, mode);
  };

  const onDownloadAll = (mode: 'zip' | 'raw') => {
    handleDownloadFiles(files, mode);
  };

  const handleDownloadSingle = (file: ProcessedFile) => {
    if (file.outputBlob) {
      const ext = getExtensionFromMime(settings.format);
      const fileName = `${file.newName}.${ext}`;
      FileSaver.saveAs(file.outputBlob, fileName);
    }
  };

  const completedCount = files.filter(f => f.status === ProcessStatus.COMPLETED).length;
  const hasFiles = files.length > 0;
  const allCompleted = hasFiles && completedCount > 0 && completedCount === files.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-100">
      <Header language={language} setLanguage={setLanguage} t={t} />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-8">
        
        {/* --- Controls Section --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Format Settings */}
          <div className="bg-surface border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Settings className="w-5 h-5" />
              <h2 className="font-semibold">{t.settingsTitle}</h2>
            </div>
            
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t.targetFormat}</label>
                <select 
                  className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={settings.format}
                  onChange={(e) => setSettings(s => ({ ...s, format: e.target.value as OutputFormat }))}
                  disabled={isProcessing}
                >
                  <option value={OutputFormat.JPEG}>{t.formatJpeg}</option>
                  <option value={OutputFormat.PNG}>{t.formatPng}</option>
                  <option value={OutputFormat.WEBP}>{t.formatWebp}</option>
                </select>
              </div>

              <div>
                 <label className="block text-xs text-gray-400 mb-1.5">{t.quality} ({Math.round(settings.quality * 100)}%)</label>
                 <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.05" 
                    value={settings.quality}
                    onChange={(e) => setSettings(s => ({ ...s, quality: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-dark rounded-lg appearance-none cursor-pointer accent-primary"
                    disabled={isProcessing}
                 />
              </div>
            </div>
          </div>

          {/* Resize Settings */}
          <div className="bg-surface border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col">
             <div className="flex items-center gap-2 mb-4 text-secondary">
                <Maximize2 className="w-5 h-5" />
                <h2 className="font-semibold">{t.resizeTitle}</h2>
             </div>

             <div className="space-y-4 flex-1 flex flex-col">
               {/* Unit Switcher */}
               <div className="flex items-center bg-dark border border-gray-700 rounded-lg p-1 mb-2">
                 <button
                   onClick={() => setSettings(s => ({ ...s, resizeMode: 'scale' }))}
                   className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${settings.resizeMode === 'scale' ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                   disabled={isProcessing}
                 >
                   {t.modeScale}
                 </button>
                 <button
                   onClick={() => setSettings(s => ({ ...s, resizeMode: 'px' }))}
                   className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${settings.resizeMode === 'px' ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                   disabled={isProcessing}
                 >
                   {t.modePx}
                 </button>
                 <button
                   onClick={() => setSettings(s => ({ ...s, resizeMode: 'cm' }))}
                   className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${settings.resizeMode === 'cm' ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                   disabled={isProcessing}
                 >
                   {t.modeCm}
                 </button>
               </div>

                {settings.resizeMode === 'scale' ? (
                  <div>
                     <label className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>{t.scale}</span>
                        <span className="text-secondary font-mono font-bold">
                          {settings.scale === 1 ? t.originalSize : `${Math.round(settings.scale * 100)}%`}
                        </span>
                     </label>
                     <input 
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.1" 
                        value={settings.scale}
                        onChange={(e) => setSettings(s => ({ ...s, scale: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-dark rounded-lg appearance-none cursor-pointer accent-secondary"
                        disabled={isProcessing}
                     />
                     <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                        <span>10%</span>
                        <span>50%</span>
                        <span>100%</span>
                     </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1.5">{t.width} ({settings.resizeMode})</label>
                        <input 
                          type="number"
                          min="0"
                          step={settings.resizeMode === 'cm' ? "0.1" : "1"}
                          className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all placeholder-gray-600"
                          placeholder="Auto"
                          value={settings.width}
                          onChange={(e) => setSettings(s => ({ ...s, width: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                          disabled={isProcessing}
                        />
                      </div>
                      <span className="text-gray-500 pb-2">x</span>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1.5">{t.height} ({settings.resizeMode})</label>
                        <input 
                          type="number"
                          min="0"
                          step={settings.resizeMode === 'cm' ? "0.1" : "1"}
                          className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all placeholder-gray-600"
                          placeholder="Auto"
                          value={settings.height}
                          onChange={(e) => setSettings(s => ({ ...s, height: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={settings.maintainAspectRatio}
                        onChange={(e) => setSettings(s => ({ ...s, maintainAspectRatio: e.target.checked }))}
                        className="rounded border-gray-600 bg-dark text-secondary focus:ring-secondary/50 accent-secondary"
                        disabled={isProcessing}
                      />
                      <span className="text-xs text-gray-300">{t.maintainAspectRatio}</span>
                    </label>
                  </div>
                )}
             </div>
          </div>

          {/* Renaming Settings - Updated UI */}
          <div className="bg-surface border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center gap-2 mb-4 text-cyan-400">
              <TextCursorInput className="w-5 h-5" />
              <h2 className="font-semibold">{t.renameTitle}</h2>
            </div>
            
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t.baseFilename}</label>
                <input 
                  type="text" 
                  className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none placeholder-gray-600 transition-all"
                  placeholder={t.baseFilenamePlaceholder}
                  value={settings.baseFilename}
                  onChange={(e) => setSettings(s => ({ ...s, baseFilename: e.target.value }))}
                  disabled={isProcessing}
                />
              </div>
              
              <label className="flex items-center gap-3 cursor-pointer group p-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-gray-700/50">
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 shadow-sm ${settings.useSequentialNumbering ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-dark border-gray-600 group-hover:border-gray-500'}`}>
                  {settings.useSequentialNumbering && <Check className="w-3.5 h-3.5 text-black font-bold" strokeWidth={3} />}
                </div>
                <input 
                  type="checkbox"
                  className="hidden"
                  checked={settings.useSequentialNumbering}
                  onChange={(e) => setSettings(s => ({ ...s, useSequentialNumbering: e.target.checked }))}
                  disabled={isProcessing}
                />
                <span className={`text-sm select-none flex items-center gap-2 transition-colors ${settings.useSequentialNumbering ? 'text-cyan-100' : 'text-gray-400 group-hover:text-gray-300'}`}>
                  <Hash className={`w-4 h-4 ${settings.useSequentialNumbering ? 'text-cyan-400' : 'text-gray-500'}`} />
                  {t.sequentialNumbering}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* --- Main Area --- */}
        <div className="flex flex-col gap-4">
          {!hasFiles ? (
            <FileDropzone onFilesSelected={handleFilesSelected} t={t} />
          ) : (
            <div className="bg-surface border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[600px]">
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-800 bg-dark/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {selectedIds.size === files.length && files.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-500" />
                    )}
                    {t.selectAll}
                  </button>
                  <span className="h-4 w-px bg-gray-700"></span>
                  <div className="text-sm font-medium text-gray-400">
                    {files.length} {t.filesCount} <span className="mx-2">•</span> {completedCount} {t.convertedCount}
                    {selectedCount > 0 && <span className="text-primary ml-2">• {selectedCount} {t.selectedCount}</span>}
                  </div>
                </div>
                
                <div className="flex gap-2">
                   <Button 
                    variant="secondary" 
                    onClick={() => document.getElementById('add-more-input')?.click()}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5"
                  >
                    {t.addMore}
                  </Button>
                  <input 
                    id="add-more-input"
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={(e) => {
                      if(e.target.files && e.target.files.length > 0) {
                        handleFilesSelected((Array.from(e.target.files) as File[]).filter(f => f.type.startsWith('image/')))
                      }
                    }}
                  />
                  <Button 
                    variant="danger" 
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5"
                  >
                    <Trash2 className="w-3 h-3" /> {t.clearAll}
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto p-4 space-y-3 flex-1 min-h-[200px]">
                {files.map((file) => (
                  <FileItem 
                    key={file.id} 
                    item={file} 
                    targetFormat={settings.format}
                    isSelected={selectedIds.has(file.id)}
                    onToggleSelect={handleToggleSelect}
                    onRemove={handleRemoveFile}
                    onDownload={handleDownloadSingle}
                    t={t}
                  />
                ))}
              </div>
              
              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-800 bg-dark/50 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0">
                 {/* Left: Status / Reset */}
                 <div className="flex gap-2 w-full md:w-auto justify-start">
                    {allCompleted && (
                      <Button variant="secondary" onClick={() => {
                        setFiles(prev => prev.map(f => ({...f, status: ProcessStatus.IDLE})));
                      }}>
                        <RefreshCcw className="w-4 h-4" /> {t.reset}
                      </Button>
                    )}
                 </div>

                 {/* Right: Actions */}
                 <div className="flex gap-3 w-full md:w-auto justify-end flex-wrap">
                   {!allCompleted ? (
                     <Button 
                      onClick={startProcessing} 
                      isLoading={isProcessing}
                      disabled={files.filter(f => f.status === ProcessStatus.IDLE).length === 0}
                      className="w-full md:w-auto"
                     >
                       {!isProcessing && <Play className="w-4 h-4 fill-current" />}
                       {isProcessing ? t.converting : t.startConversion}
                     </Button>
                   ) : (
                     <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
                       {/* Selected Downloads Group */}
                       {selectedCount > 0 && (
                         <div className="flex items-center gap-2 bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                           <span className="text-xs font-bold text-primary px-2 uppercase">{t.downloadSelected}</span>
                           <Button 
                              onClick={() => onDownloadSelected('zip')}
                              className="text-xs py-1.5 px-3 bg-primary/20 hover:bg-primary/30 border-0"
                              title={t.asZip}
                            >
                              <FileArchive className="w-4 h-4 mr-1" /> ZIP
                            </Button>
                            <Button 
                              onClick={() => onDownloadSelected('raw')}
                              className="text-xs py-1.5 px-3 bg-primary/20 hover:bg-primary/30 border-0"
                              title={t.asRaw}
                            >
                              <FilesIcon className="w-4 h-4 mr-1" /> Raw
                            </Button>
                         </div>
                       )}

                       {/* All Downloads Group */}
                       <div className="flex items-center gap-2 bg-gray-800 p-1.5 rounded-lg border border-gray-700">
                         <span className="text-xs font-bold text-gray-400 px-2 uppercase">{t.downloadAll}</span>
                         <Button 
                            onClick={() => onDownloadAll('zip')}
                            className="text-xs py-1.5 px-3 bg-gray-700 hover:bg-gray-600 border-0"
                            title={t.asZip}
                          >
                            <FileArchive className="w-4 h-4 mr-1" /> ZIP
                          </Button>
                          <Button 
                            onClick={() => onDownloadAll('raw')}
                            className="text-xs py-1.5 px-3 bg-gray-700 hover:bg-gray-600 border-0"
                            title={t.asRaw}
                          >
                            <FilesIcon className="w-4 h-4 mr-1" /> Raw
                          </Button>
                       </div>
                     </div>
                   )}
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 space-y-2">
        <p>{t.localProcessing}</p>
        <p>
          {t.termsPrefix}
          <a
            href="https://ukpr-riyoukiyaku.pages.dev/#/tos/pixmorph"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t.termsLinkText}
          </a>
          {t.termsSuffix}
        </p>
        <p className="opacity-75">Powered by Google AI Studio</p>
      </footer>
    </div>
  );
};

export default App;