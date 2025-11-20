
import React, { useCallback, useState } from 'react';
import { Upload, FileText, FileSpreadsheet, Files } from 'lucide-react';
import { parseClaimsData, parseExcelReport } from '../utils/parser';
import { Claim } from '../types';

interface UploadScreenProps {
  onDataLoaded: (claims: Claim[], providerName: string) => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onDataLoaded }) => {
  const [textInput, setTextInput] = useState('');
  const [providerName, setProviderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    if (files.length > 12) {
      setError('Maximum limit reached. Please upload up to 12 files at a time.');
      return;
    }
    
    setError(null);
    setIsProcessing(true);
    
    let combinedClaims: Claim[] = [];

    try {
      const fileArray = Array.from(files);
      
      const processingPromises = fileArray.map(async (file) => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
          const buffer = await file.arrayBuffer();
          return parseExcelReport(buffer, providerName);
        } else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
          const text = await file.text();
          return parseClaimsData(text, providerName);
        } else {
          throw new Error(`Unsupported file type: ${file.name}`);
        }
      });

      const results = await Promise.all(processingPromises);

      results.forEach(fileClaims => {
        combinedClaims = [...combinedClaims, ...fileClaims];
      });

      if (combinedClaims.length === 0) {
        setError('No valid claims data found in the uploaded files. Please check the file formats.');
      } else {
        // Re-index IDs to ensure uniqueness across merged files
        const reindexedClaims = combinedClaims.map((c, i) => ({
          ...c,
          id: i + 1
        }));
        onDataLoaded(reindexedClaims, providerName);
      }
    } catch (err) {
      setError('Failed to process files: ' + (err instanceof Error ? err.message : String(err)));
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualAnalyze = () => {
    try {
      if (!textInput.trim()) return;
      const claims = parseClaimsData(textInput, providerName);
      if (claims.length === 0) {
        setError('No valid claims found in pasted text.');
        return;
      }
      onDataLoaded(claims, providerName);
    } catch (err) {
      setError('Parsing error: ' + String(err));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [providerName]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Files className="text-blue-600 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Provider Claims Analytics</h1>
          <p className="text-gray-500 mt-2">Upload multiple Patient Visit Reports (Excel) or standard CSVs.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Provider Name (Optional)</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Dr. Smith (Used if provider name is missing)"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
            />
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
              ${isProcessing ? 'opacity-50 cursor-wait' : ''}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                <p className="text-blue-600 font-medium">Processing multiple files...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-4 mb-3">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                  <Upload className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">Drag & Drop Excel (.xls, .xlsx) or CSV files</p>
                <p className="text-gray-400 text-sm mt-1">Supports up to 12 files at once</p>
                <label className="mt-4 inline-block">
                  <span className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition cursor-pointer text-sm font-semibold">Select Files</span>
                  <input 
                    type="file" 
                    accept=".csv,.tsv,.txt,.xls,.xlsx" 
                    multiple 
                    className="hidden" 
                    onChange={(e) => processFiles(e.target.files)} 
                  />
                </label>
              </>
            )}
            {error && <p className="text-red-500 text-sm mt-4 bg-red-50 py-2 rounded border border-red-100">{error}</p>}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or paste raw CSV data</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <textarea
            className="w-full h-32 p-4 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Paste CSV/TSV content here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          ></textarea>

          <button 
            onClick={handleManualAnalyze}
            disabled={!textInput.trim()}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold shadow-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Analyze Pasted Data
          </button>
        </div>
      </div>
    </div>
  );
};
