import React, { createContext, useContext, useState, useEffect } from 'react';
import { Settings } from '../types';
import { DEFAULT_FACILITY_HANDOFF_TEMPLATE } from '../lib/productionTemplate';
import { FACILITY_STORAGE_KEYS } from '../lib/storageUtils';

const defaultSettings: Settings = {
  apiKey: '',
  model: 'gemini-3.1-pro-preview',
  defaultDuration: '3',
  defaultStyle: 'Educational',
  sceneDurationSeconds: 10,
  facilityHandoffTemplate: DEFAULT_FACILITY_HANDOFF_TEMPLATE,
  facilityHandoffTemplateName: 'Secret Defence Facilities Visual Production Handoff 0.9.0',
};

interface SettingsContextType {
  settings: Settings;
  setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(FACILITY_STORAGE_KEYS.settings);
    if (stored) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(FACILITY_STORAGE_KEYS.settings, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
