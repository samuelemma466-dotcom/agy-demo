export interface DevProject {
  id: string;
  name: string;
  path: string;
  branch: string;
  status: 'clean' | 'modified' | 'untracked';
  techStack: string[];
  lastModified: string;
}

export interface TerminalCommandPreset {
  id: string;
  title: string;
  actionId: string;
  command: string;
  category: 'Git' | 'System' | 'Containers' | 'Build';
  description: string;
}
