export interface AutoImageAltSettings {
  anthropicApiKey: string;
  anthropicModel: string;
  prompt: string;
  syncSensitiveSettings: boolean;
}

const DEFAULT_SETTINGS: AutoImageAltSettings = {
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20240620',
  prompt: 'Provide a description of this image suitable for use as HTML alt-text. Do not use line breaks or square bracket characters in your description.',
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
