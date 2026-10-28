export type JarvisRole = 'user' | 'assistant' | 'system';

export interface JarvisMessage {
  id: string;
  role: JarvisRole;
  text: string;
  timestamp: string;
  suggestedCommand?: string;
  isSimulatedEngine: boolean;
}
