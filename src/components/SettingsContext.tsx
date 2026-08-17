import React, { createContext, useContext, useState, useEffect } from 'react';
import { Settings } from '../types';
import { DEFAULT_FACILITY_HANDOFF_TEMPLATE } from '../lib/productionTemplate';
import { loadSettings, saveSettings } from '../lib/storageUtils';
import { DEFAULT_SCENE_DURATION_SECONDS, normalizeSceneDuration } from '../lib/sceneDuration';
import { toast } from 'sonner';

const defaultSettings: Settings = {
  apiKey: '',
  model: 'gemini-3.1-pro-preview',
  defaultDuration: '3',
  defaultStyle: 'Educational',
  sceneDurationSeconds: DEFAULT_SCENE_DURATION_SECONDS,
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
    let cancelled = false;
    const restoreSettings = async () => {
      try {
        const parsed = await loadSettings();
        if (cancelled) return;
        if (!parsed) {
          setIsLoaded(true);
          return;
        }
        setSettings({
          ...defaultSettings,
          ...parsed,
          sceneDurationSeconds: normalizeSceneDuration(parsed.sceneDurationSeconds, defaultSettings.sceneDurationSeconds),
        });
      } catch (e) {
        console.error('Failed to restore settings', e);
        toast.error('Settings could not be restored. Safe defaults are active.');
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    void restoreSettings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isLoaded) {
      void saveSettings(settings).catch(error => {
        console.error('Failed to save settings', error);
        toast.error('Settings could not be saved to browser storage.');
      });
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
