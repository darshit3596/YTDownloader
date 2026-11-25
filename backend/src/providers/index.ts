import { directUrlProvider } from './direct.provider';
import { youtubeProvider } from './youtube.provider';
import type { MediaProvider } from './types';

/**
 * Provider registry. Order matters: the YouTube metadata provider claims
 * YouTube hosts before the generic direct-URL provider.
 */
export const providers: MediaProvider[] = [youtubeProvider, directUrlProvider];

export function resolveProvider(url: string): MediaProvider {
  const provider = providers.find((candidate) => candidate.canHandle(url));
  if (!provider) {
    throw new Error('No provider is registered for this URL.');
  }
  return provider;
}

export { directUrlProvider, youtubeProvider };
export type { AnalyzedMedia, MediaProvider } from './types';
