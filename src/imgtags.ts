import { normalizePath } from "obsidian";

export interface ImageTag {
  target: string,
  tagBegin: number,
  tagEnd: number,
  altBegin: number,
  altEnd: number,
}

export function locateImages(text: string): ImageTag[] {
  // TODO this is very hacky and will not handle cases like nested brackets
  const regex = /!\[(.*?)\]\((.*?)(\s+.*?)?\)/dg;
  const result: ImageTag[] = [];
  for (let match of text.matchAll(regex)) {
    result.push({
      target: match[2],
      tagBegin: match.indices[0][0],
      tagEnd: match.indices[0][1],
      altBegin: match.indices[1][0],
      altEnd: match.indices[1][1],
    });
  }
  return result;
}

export function buildImagePath(fromDir: string, imageUrl: string): string {
  // TODO this is super hacky, also doesn't handle URLs at all yet
  return normalizePath(fromDir + '/' + decodeURI(imageUrl));
}
