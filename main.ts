import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import { dataFromSettings, settingsFromData, AutoImageAltSettings } from 'src/settings';
import { AltGen } from 'src/generation';
import { buildImagePath, locateImages } from 'src/imgtags';

export default class AutoImageAlt extends Plugin {
  settings: AutoImageAltSettings;

  async onload() {
    await this.loadSettings();
    
    this.addSettingTab(new AutoImageAltSettingTab(this.app, this));
    
    this.addCommand({
      id: "generate-missing",
      name: "Generate missing alt-texts",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const altgen = new AltGen(this.settings);
        const images = locateImages(editor.getValue()).filter(im => im.altEnd == im.altBegin);
        images.reverse();
        for (const image of images) {
          // TODO this is all super hacky
          // TODO need to handle paths relative to the open file
          // TODO need to handle URLs
          const imagePath = buildImagePath(view.file?.parent?.path || '', image.target);
          const imageFile = this.app.vault.getFileByPath(imagePath);
          if (imageFile) {
            const imageData = await this.app.vault.readBinary(imageFile);
            const result = await altgen.generate(imageFile.name, imageData);
            editor.replaceRange(result, editor.offsetToPos(image.altBegin), editor.offsetToPos(image.altEnd));
          }
        }
      },
    });
  }
  
  onunload() {
    
  }
  
  async loadSettings() {
    this.settings = settingsFromData(await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(dataFromSettings(this.settings));
  }
}

function fragmentForHTML(html: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const div = fragment.createDiv();
  div.innerHTML = html;
  return fragment;
}

class AutoImageAltSettingTab extends PluginSettingTab {
  plugin: AutoImageAlt;
  
  constructor(app: App, plugin: AutoImageAlt) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const {containerEl} = this;
    
    containerEl.empty();

    new Setting(containerEl)
      .setName('Sync sensitive settings')
      .setDesc(fragmentForHTML('By default, for security reasons, the API key below will <b>NOT</b> be saved, and you will need to re-enter it upon reloading the plugin or restarting Obsidian. If you\'re <i>sure</i> you want to save it, you can enable this toggle.<br/><b>Danger</b>: enabling this will cause your API key to be stored unencrypted in your data.json file.'))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncSensitiveSettings)
        .onChange(async (value) => {
          this.plugin.settings.syncSensitiveSettings = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Anthropic API key')
      .setDesc(fragmentForHTML('Your API key. This is used to make requests to Claude containing your images and asking it to describe them. See <a href="https://docs.anthropic.com/en/api/getting-started">the Anthropic API\'s Getting Started page</a>.<br/><b>Note:</b> For security reasons, this is currently not saved, and must be re-entered after restarting Obsidian or reloading the plugin.'))
      .addText(text => text
        .setPlaceholder('Enter your API key')
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
        }));
      
    new Setting(containerEl)
      .setName('Anthropic model')
      .setDesc(fragmentForHTML('The model identifier you want to use when making requests to Claude. See <a href="https://docs.anthropic.com/en/docs/about-claude/models">the Anthropic User Guide\'s Models page</a>.'))
      .addText(text => text
        .setPlaceholder('Enter a model identifier')
        .setValue(this.plugin.settings.anthropicModel)
        .onChange(async (value) => {
          this.plugin.settings.anthropicModel = value;
          await this.plugin.saveSettings();
        }));
  }
}
    