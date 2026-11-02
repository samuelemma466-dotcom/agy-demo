import { DevProject, TerminalCommandPreset } from '../types/developer';

export interface RecentItem {
  id: string;
  name: string;
  category: 'file' | 'project' | 'command';
  detail: string;
  timestamp: string;
  iconName: string;
}

export const MOCK_PROJECTS: DevProject[] = [
  {
    id: 'proj-1',
    name: 'Omachy Desktop',
    path: '/home/biggiesam/agy-demo',
    branch: 'main',
    status: 'clean',
    techStack: ['React', 'TypeScript', 'Vite', 'CSS3'],
    lastModified: 'Just now',
  },
  {
    id: 'proj-2',
    name: 'Omarchy System Configs',
    path: '/home/biggiesam/dotfiles',
    branch: 'omarchy-main',
    status: 'modified',
    techStack: ['Hyprland', 'Waybar', 'Fish', 'Lua'],
    lastModified: '2 hours ago',
  },
  {
    id: 'proj-3',
    name: 'Jarvis Neural Bridge',
    path: '/home/biggiesam/Projects/jarvis-core',
    branch: 'feature/dbus-service',
    status: 'clean',
    techStack: ['Python', 'FastAPI', 'Ollama', 'D-Bus'],
    lastModified: 'Yesterday',
  },
];

export const MOCK_TERMINAL_PRESETS: TerminalCommandPreset[] = [
  {
    id: 'term-1',
    title: 'Git Status Summary',
    actionId: 'git_status',
    command: 'git status -sb',
    category: 'Git',
    description: 'Show working branch and condensed file status',
  },
  {
    id: 'term-2',
    title: 'Process Summary',
    actionId: 'process_summary',
    command: 'ps -eo pid,comm,%cpu,%mem --sort=-%cpu',
    category: 'System',
    description: 'Show a fixed, read-only summary of running processes',
  },
  {
    id: 'term-3',
    title: 'Storage & Disk Utilization',
    actionId: 'disk_usage',
    command: 'df -h /',
    category: 'System',
    description: 'Inspect non-temporary disk partitions',
  },
  {
    id: 'term-4',
    title: 'Docker Containers Running',
    actionId: 'docker_containers',
    command: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
    category: 'Containers',
    description: 'Inspect active containers and exposed network ports',
  },
  {
    id: 'term-5',
    title: 'User Systemd Services',
    actionId: 'user_services',
    command: 'systemctl --user list-units --type=service --state=running',
    category: 'System',
    description: 'List user-level background services',
  },
];

export const MOCK_RECENT_ITEMS: RecentItem[] = [
  {
    id: 'rec-1',
    name: 'Omachy Desktop (prototype)',
    category: 'project',
    detail: 'Opened in workspace',
    timestamp: '10 min ago',
    iconName: 'FolderGit2',
  },
  {
    id: 'rec-2',
    name: 'omarchy-theme-config.tar.gz',
    category: 'file',
    detail: 'Staged for transfer',
    timestamp: '25 min ago',
    iconName: 'FileArchive',
  },
  {
    id: 'rec-3',
    name: 'git status -sb',
    category: 'command',
    detail: 'Executed in terminal shortcut',
    timestamp: '1 hour ago',
    iconName: 'Terminal',
  },
  {
    id: 'rec-4',
    name: 'Pixel 8 (KDE Connect Discovery)',
    category: 'file',
    detail: 'Device broadcast packet received',
    timestamp: '2 hours ago',
    iconName: 'Smartphone',
  },
];
