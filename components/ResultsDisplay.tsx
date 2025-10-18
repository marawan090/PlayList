import React, { useState } from 'react';
import { Spinner, CopyIcon, DownloadIcon, CheckIcon, ErrorIcon } from './Icons';
import { ApiResult, ApiFeature } from '../services/youtubeApiService';

type ResultEntry = {
    status: 'fulfilled' | 'rejected';
    data?: ApiResult;
    error?: string;
    label: string;
};

interface ResultsDisplayProps {
  results: Partial<Record<ApiFeature, ResultEntry>> | null;
  isLoading: boolean;
  hasFetched: boolean;
}

type CopyStatus = 'idle' | 'copied';

const formatDataForExport = (resultData: ApiResult | undefined, format: 'txt' | 'csv' | 'json'): { content: string; mimeType: string; fileExtension: string } => {
    if (!resultData) return { content: '', mimeType: 'text/plain', fileExtension: 'txt' };
  
    const { type, data } = resultData;
  
    if (format === 'json') {
      return {
        content: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        fileExtension: 'json',
      };
    }
  
    let textContent = '';
    let csvContent = '';
  
    if (type === 'list' && Array.isArray(data)) {
      textContent = data.join('\n');
      csvContent = `"Title"\n${data.map(title => `"${title.replace(/"/g, '""')}"`).join('\n')}`;
    } else if (type === 'details' && typeof data === 'object' && data !== null) {
      textContent = Object.entries(data).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}`).join('\n');
      csvContent = `"Key","Value"\n${Object.entries(data).map(([key, value]) => `"${key}","${String(value).replace(/"/g, '""')}"`).join('\n')}`;
    }
  
    if (format === 'txt') {
      return { content: textContent, mimeType: 'text/plain', fileExtension: 'txt' };
    } else { // csv
      return { content: csvContent, mimeType: 'text/csv', fileExtension: 'csv' };
    }
};

const ResultViewer = ({ results }: { results: ApiResult }) => {
    if (results.type === 'list') {
        return (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                {results.data.map((item, index) => (
                    <li key={index} className="px-4 sm:px-6 py-3 flex items-start">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-10 flex-shrink-0">{index + 1}.</span>
                        <span className="text-slate-800 dark:text-slate-200">{item}</span>
                    </li>
                ))}
            </ul>
        );
    }

    if (results.type === 'details') {
        return (
            <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
                <dl className="divide-y divide-slate-200 dark:divide-slate-700">
                    {Object.entries(results.data).map(([key, value]) => (
                        <div key={key} className="py-3 grid grid-cols-3 gap-4">
                            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</dt>
                            <dd className="text-sm text-slate-900 dark:text-slate-200 col-span-2">{String(value)}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    }
    
    return null;
}

const ResultCard = ({ featureKey, resultEntry }: { featureKey: ApiFeature; resultEntry: ResultEntry }) => {
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

    const handleCopy = () => {
        const { content } = formatDataForExport(resultEntry.data, 'txt');
        navigator.clipboard.writeText(content).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        });
    };

    const handleDownload = (format: 'txt' | 'csv' | 'json') => {
        const { content, mimeType, fileExtension } = formatDataForExport(resultEntry.data, format);
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube_${featureKey}_data.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const isSuccess = resultEntry.status === 'fulfilled' && resultEntry.data;
    const resultCount = isSuccess && Array.isArray(resultEntry.data?.data) 
        ? resultEntry.data.data.length 
        : isSuccess && typeof resultEntry.data?.data === 'object' ? Object.keys(resultEntry.data.data).length : 0;

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-lg ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
            <div className="p-4 sm:p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {resultEntry.label}
                    {isSuccess && resultCount > 0 && <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">({resultCount} items)</span>}
                </h3>
                {isSuccess && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">
                            {copyStatus === 'copied' ? <CheckIcon /> : <CopyIcon />}
                            {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                        </button>
                        <button onClick={() => handleDownload('json')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">
                            <DownloadIcon /> .json
                        </button>
                        <button onClick={() => handleDownload('csv')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">
                            <DownloadIcon /> .csv
                        </button>
                    </div>
                )}
            </div>
            
            {resultEntry.status === 'rejected' && (
                <div className="p-6 flex items-center gap-4 bg-red-50 dark:bg-red-900/20">
                    <ErrorIcon />
                    <div>
                        <p className="font-semibold text-red-800 dark:text-red-200">Failed to fetch data</p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">{resultEntry.error}</p>
                    </div>
                </div>
            )}

            {isSuccess && resultCount === 0 && (
                 <div className="p-6 text-center">
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No data found.</p>
                    <p className="text-slate-500 dark:text-slate-400">The resource might be empty, private, or the URL/ID is incorrect.</p>
                </div>
            )}
            
            {isSuccess && resultCount > 0 && <ResultViewer results={resultEntry.data!} />}
        </div>
    );
};

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, isLoading, hasFetched }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800/50 rounded-xl ring-1 ring-slate-900/5 dark:ring-white/10">
        <Spinner />
        <p className="mt-4 text-lg font-medium text-slate-600 dark:text-slate-400">Fetching data...</p>
      </div>
    );
  }

  if (!hasFetched) {
    return (
        <div className="text-center p-10 bg-white dark:bg-slate-800/50 rounded-xl ring-1 ring-slate-900/5 dark:ring-white/10">
            <p className="text-slate-500 dark:text-slate-400">Your results will appear here.</p>
        </div>
    );
  }
  
  if (!results) {
    return (
      <div className="text-center p-10 bg-white dark:bg-slate-800/50 rounded-xl ring-1 ring-slate-900/5 dark:ring-white/10">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">An unexpected error occurred.</p>
          <p className="text-slate-500 dark:text-slate-400">Please try your request again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(results).map(([key, entry]) => (
        <ResultCard key={key} featureKey={key as ApiFeature} resultEntry={entry} />
      ))}
    </div>
  );
};