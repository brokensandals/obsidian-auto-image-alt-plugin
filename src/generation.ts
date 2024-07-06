import { Anthropic, ClientOptions } from "@anthropic-ai/sdk";
import { AutoImageAltSettings } from "./settings";
import { RequestUrlParam, RequestUrlResponse, requestUrl } from "obsidian";
import { TextBlock } from "@anthropic-ai/sdk/resources";

export class AltGen {
  anthropic: Anthropic;
  settings: AutoImageAltSettings;
  
  constructor(settings: AutoImageAltSettings) {
    this.settings = settings;
    const opts: ClientOptions = {
      // To avoid CORS errors, we need to send the Anthropic library's requests through to Obsidian's requestUrl method
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
  
  async generate(imageFilename: string, imageData: ArrayBuffer, prompt: string): Promise<string> {
    // TODO determine media type in a cleaner and less rigid way
    let mediaType = 'image';
    const lowerFilename = imageFilename.toLowerCase();
    if (lowerFilename.endsWith('.gif')) {
      mediaType = 'image/gif';
    } else if (lowerFilename.endsWith('.jpg' || lowerFilename.endsWith('jpeg'))) {
      mediaType = 'image/jpeg';
    } else if (lowerFilename.endsWith('.png')) {
      mediaType = 'image/png';
    } else if (lowerFilename.endsWith('webp')) {
      mediaType = 'image/webp';
    }

    const message = await this.anthropic.messages.create({
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: Buffer.from(imageData).toString('base64') },
            },
            {
              type: 'text',
              text: prompt,
            }
          ],
        },
      ],
      model: this.settings.anthropicModel,
    });
    
    return message.content.filter(c => c.type == "text").map(c => (c as TextBlock).text).join("\n\n");
  }
}