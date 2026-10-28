/**
 * Jarvis Assistant Service Module
 * 
 * Purpose:
 * Prepares the conversational and system command interface for Omachy Desktop.
 * 
 * Ready for:
 * - Local Ollama endpoint (e.g. http://localhost:11434/api/generate)
 * - Local custom CLI sidecar or Gemini / Anthropic API
 * 
 * Current state:
 * - Demonstrator mode with intelligent response parser and Linux command recommendations.
 */

import { JarvisMessage } from '../../types/jarvis';

export class JarvisService {
  private history: JarvisMessage[] = [
    {
      id: 'msg-1',
      role: 'system',
      text: 'Jarvis Desktop Companion Engine initialized. Ready to assist with system commands, file tasks, and workflows.',
      timestamp: 'Today, 20:00',
      isSimulatedEngine: true,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      text: 'Welcome to Omachy Desktop! I can help you monitor system health, launch developer presets, or stage file transfers. How can I assist you today?',
      timestamp: 'Today, 20:01',
      isSimulatedEngine: true,
    },
  ];

  getHistory(): JarvisMessage[] {
    return [...this.history];
  }

  async processQuery(query: string): Promise<JarvisMessage> {
    const q = query.toLowerCase();
    let reply = "I've logged your request. In future updates with local Ollama / model sidecar, I'll execute actions directly.";
    let suggestedCommand: string | undefined = undefined;

    if (q.includes('cpu') || q.includes('system') || q.includes('resource') || q.includes('health')) {
      reply = 'System load is normal. You can view real-time process statistics with `htop` or check memory with `free -h`.';
      suggestedCommand = 'htop';
    } else if (q.includes('git') || q.includes('repo') || q.includes('status')) {
      reply = 'To inspect current git repository changes and untracked files, use `git status -sb`.';
      suggestedCommand = 'git status -sb';
    } else if (q.includes('disk') || q.includes('storage') || q.includes('space')) {
      reply = 'To check filesystem usage in human-readable format:';
      suggestedCommand = 'df -h /';
    } else if (q.includes('connect') || q.includes('phone') || q.includes('kde')) {
      reply = 'Phone connection module is in discovery mode. Pair your Android or iOS device in the Phone tab.';
    } else if (q.includes('clean') || q.includes('temp') || q.includes('cache')) {
      reply = 'To safely inspect package cache sizes on Arch Linux:';
      suggestedCommand = 'du -sh ~/.cache';
    }

    const responseMsg: JarvisMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedCommand,
      isSimulatedEngine: true,
    };

    this.history.push(responseMsg);
    return responseMsg;
  }
}

export const jarvisService = new JarvisService();
