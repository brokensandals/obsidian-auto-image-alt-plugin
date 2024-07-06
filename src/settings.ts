export interface AutoImageAltSettings {
  anthropicApiKey: string;
  anthropicModel: string;
  syncSensitiveSettings: boolean;
}

const DEFAULT_SETTINGS: AutoImageAltSettings = {
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20240620',
  syncSensitiveSettings: false,
}

function scrubbedSettings(settings: AutoImageAltSettings): AutoImageAltSettings {
  return {
    ...DEFAULT_SETTINGS,
    anthropicModel: settings.anthropicModel,
  };
}

export function settingsFromData(data: Object): AutoImageAltSettings {
  return Object.assign({}, DEFAULT_SETTINGS, data);
}

export function dataFromSettings(settings: AutoImageAltSettings): Object {
  return settings.syncSensitiveSettings ? settings : scrubbedSettings(settings);
}
