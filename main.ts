import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, RequestUrlParam, RequestUrlResponse, Setting, requestUrl } from 'obsidian';
import { Anthropic, ClientOptions } from '@anthropic-ai/sdk';
import { TextBlock } from '@anthropic-ai/sdk/resources';

interface AutoImageAltSettings {
	anthropicApiKey: string;
	anthropicModel: string;
}

const DEFAULT_SETTINGS: AutoImageAltSettings = {
	anthropicApiKey: '',
	anthropicModel: 'claude-3-5-sonnet-20240620',
}

type SensitiveSettings = Pick<AutoImageAltSettings, 'anthropicApiKey'>
function sensitiveSettings({ anthropicApiKey }: AutoImageAltSettings): SensitiveSettings {
	return { anthropicApiKey };
}

type NonsensitiveSettings = Pick<AutoImageAltSettings, 'anthropicModel'>
function nonsensitiveSettings({ anthropicModel }: AutoImageAltSettings): NonsensitiveSettings {
	return { anthropicModel };
}

class AltGen {
	anthropic: Anthropic;
	settings: AutoImageAltSettings;

	constructor(settings: AutoImageAltSettings) {
		this.settings = settings;
		const opts: ClientOptions = {
			fetch: async (url: RequestInfo, init?: RequestInit): Promise<Response> => {
				const fetchReq = (typeof url === 'string' || url instanceof String) ? null : (url as Request);
				const urlString = fetchReq === null ? (url as string) : fetchReq.url;
				const obsidianReq: RequestUrlParam = {
					url: urlString,
				};

				if (fetchReq?.body) {
					obsidianReq.body = fetchReq.body;
				} else if (init?.body) {
					obsidianReq.body = init.body;
				}

				if (fetchReq?.headers) {
					obsidianReq.headers = {...fetchReq.headers};
				} else if (init?.headers) {
					obsidianReq.headers = {...init.headers};
				}
				if (obsidianReq.headers) {
					// SimpleURLLoaderWrapper will throw ERR_INVALID_ARGUMENT if you try to pass this
					delete obsidianReq.headers['content-length'];
				}

				if (fetchReq?.method) {
					obsidianReq.method = fetchReq.method;
				} else if (init?.method) {
					obsidianReq.method = init.method;
				}

				const obsidianResp: RequestUrlResponse = await requestUrl(obsidianReq);
				const fetchResp = new Response(
					obsidianResp.arrayBuffer,
					{
						status: obsidianResp.status,
						headers: obsidianResp.headers,
					});
				return fetchResp;
			},
		};
		if (settings.anthropicApiKey) {
			opts.apiKey = settings.anthropicApiKey;
		}
		this.anthropic = new Anthropic(opts);
	}

	async generate(): Promise<string> {
		const message = await this.anthropic.messages.create({
			max_tokens: 1024,
			messages: [{ role: 'user', content: 'Tell me a one-line joke.' }],
			model: this.settings.anthropicModel,
		});

		return message.content.filter(c => c.type == "text").map(c => (c as TextBlock).text).join("\n\n");
	}
}

export default class AutoImageAlt extends Plugin {
	settings: AutoImageAltSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutoImageAltSettingTab(this.app, this));

		this.addCommand({
			id: "generate-selected",
			name: "Generate alt-text for selected image",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const altgen = new AltGen(this.settings);
				const result = await altgen.generate();
				new Notice(result);
			},
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(nonsensitiveSettings(this.settings));
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
