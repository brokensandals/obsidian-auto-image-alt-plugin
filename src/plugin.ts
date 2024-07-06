import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { dataFromSettings, settingsFromData, AutoImageAltSettings } from './settings';
import { AltGen } from './generation';
import { ImageTag, buildImagePath, locateImages } from './imgtags';

export class AutoImageAlt extends Plugin {
  settings: AutoImageAltSettings;

  async onload() {
    await this.loadSettings();
    
    this.addSettingTab(new AutoImageAltSettingTab(this.app, this));
    
    this.addCommand({
      id: "generate-missing",
      name: "Generate missing alt-texts",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        return await this.generateAndUpdate(editor, view, (im => im.altEnd == im.altBegin));
      },
    });

    this.addCommand({
      id: "Generate-all",
      name: "Generate or regenerate all alt-texts",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        return await this.generateAndUpdate(editor, view, (_ => true));
      },
    });

    this.addCommand({
      id: "generate-selected",
      name: "Generate or regenerate alt-texts of images in selection",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        // This was written hastily and might contain some redundant or ill-conceived code (and, of course, bugs)
        // My goal was to treat an image as 'selected' if the cursor or any part of any selection has any overlap with the image tag

        const ranges: number[][] = [];
        ranges.push([editor.posToOffset(editor.getCursor()), editor.posToOffset(editor.getCursor())]);
        for (const sel of editor.listSelections()) {
          let off1 = editor.posToOffset(sel.anchor);
          let off2 = editor.posToOffset(sel.head);
          if (off2 < off1) {
            [off1, off2] = [off2, off1];
          }
          ranges.push([off1, off2]);
        }

        return await this.generateAndUpdate(
          editor,
          view,
          (im => ranges.some(r => (r[0] >= im.tagBegin && r[0] <= im.tagEnd) || (r[1] >= im.tagBegin && r[0] <= im.tagEnd))));
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

  async generateAndUpdate(editor: Editor, view: MarkdownView, filter: (img: ImageTag) => boolean) {
    const altgen = new AltGen(this.settings);
    const images = locateImages(editor.getValue()).filter(filter);
    images.reverse();
    for (const image of images) {
      // TODO this is all super hacky
      // TODO need to handle URLs
      const imagePath = buildImagePath(view.file?.parent?.path || '', image.target);
      const imageFile = this.app.vault.getFileByPath(imagePath);
      if (imageFile) {
        const imageData = await this.app.vault.readBinary(imageFile);
        const result = await altgen.generate(imageFile.name, imageData, this.settings.prompt);
        editor.replaceRange(result, editor.offsetToPos(image.altBegin), editor.offsetToPos(image.altEnd));
      }
    }
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
    
    new Setting(containerEl)
      .setName("Prompt")
      .setDesc("The prompt for asking the model to generate an image description.")
      .addTextArea(text => text
        .setPlaceholder('Enter a prompt')
        .setValue(this.plugin.settings.prompt)
        .onChange(async (value) => {
          this.plugin.settings.prompt = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName("Template")
      .setDesc("Use this to add any boilerplate before/after the generated description. $desc$ will be replaced with the generatd alt-text.")
      .addTextArea(text => text
        .setPlaceholder('Enter a template')
        .setValue(this.plugin.settings.template)
        .onChange(async (value) => {
          this.plugin.settings.template = value;
          await this.plugin.saveSettings();
        }));
  }
}
