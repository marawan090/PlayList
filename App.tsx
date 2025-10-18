import React, { useState, useCallback, useMemo } from 'react';
import { UrlInputForm } from './components/UrlInputForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Logo } from './components/Icons';
import {
  fetchPlaylistItems,
  fetchPlaylistDetails,
  fetchPlaylistDuration,
  ApiResult,
  ApiFeature,
} from './services/youtubeApiService';
  
export type FeatureConfig = {
    key: ApiFeature;
    label: string;
    group: 'Playlist'; // Only playlist group remains
    fetcher: (input: string) => Promise<ApiResult>;
};

const FEATURES: FeatureConfig[] = [
  { key: 'playlistItems', label: 'Playlist Items', group: 'Playlist', fetcher: fetchPlaylistItems },
  { key: 'playlistDetails', label: 'Playlist Details', group: 'Playlist', fetcher: fetchPlaylistDetails },
  { key: 'playlistDuration', label: 'Playlist Duration', group: 'Playlist', fetcher: fetchPlaylistDuration },
];

type ResultEntry = {
    status: 'fulfilled' | 'rejected';
    data?: ApiResult;
    error?: string;
    label: string;
};

function App() {
  const [selectedFeatures, setSelectedFeatures] = useState<Set<ApiFeature>>(new Set(['playlistItems']));
  const [inputValue, setInputValue] = useState<string>('');
  const [results, setResults] = useState<Partial<Record<ApiFeature, ResultEntry>> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  const handleFeatureToggle = (key: ApiFeature) => {
    setSelectedFeatures(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        return newSet;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim()) {
      setError('Please enter a valid URL or ID.');
      return;
    }
    if (selectedFeatures.size === 0) {
      setError('Please select at least one feature to fetch.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setHasFetched(false);

    const featuresToFetch = FEATURES.filter(f => selectedFeatures.has(f.key));
    
    const promises = featuresToFetch.map(feature => 
      feature.fetcher(inputValue)
        .then(data => ({ key: feature.key, status: 'fulfilled' as const, data, label: feature.label }))
        .catch(err => ({ key: feature.key, status: 'rejected' as const, error: err.message, label: feature.label }))
    );

    const settledResults = await Promise.all(promises);

    const newResults: Partial<Record<ApiFeature, ResultEntry>> = {};
    settledResults.forEach(res => {
        const { key, ...entry } = res;
        newResults[key] = entry;
    });

    setResults(newResults);
    setIsLoading(false);
    setHasFetched(true);

  }, [inputValue, selectedFeatures]);
  
  const placeholder = selectedFeatures.size > 0 
    ? 'Enter YouTube Playlist URL...' 
    : 'Select a feature to see input options...';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-8 sm:py-12 px-4 font-sans text-slate-800 dark:text-slate-200">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Logo />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Playlist Pulse
            </h1>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Select one or more features to fetch data for a YouTube playlist.
          </p>
        </header>

        <main>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-lg ring-1 ring-slate-900/5 dark:ring-white/10 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Select Features</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
                {FEATURES.map(feature => (
                  <label key={feature.key} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFeatures.has(feature.key)}
                      onChange={() => handleFeatureToggle(feature.key)}
                      className="h-4 w-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <UrlInputForm
              url={inputValue}
              setUrl={setInputValue}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder={placeholder}
              disabled={selectedFeatures.size === 0}
            />
          </div>

          {error && (
            <div className="mt-6 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="mt-8">
            <ResultsDisplay
              results={results}
              isLoading={isLoading}
              hasFetched={hasFetched}
            />
          </div>
        </main>
        
        <footer className="text-center mt-12 text-slate-500 dark:text-slate-400 text-sm">
            <p>Crafted with <span role="img" aria-label="love">❤️</span> by Engineer Marawan Elkzaz</p>
        </footer>
      </div>
    </div>
  );
}

export default App;