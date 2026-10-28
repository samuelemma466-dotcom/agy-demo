export type NavigationTab = 
  | 'home' 
  | 'files' 
  | 'phone' 
  | 'jarvis' 
  | 'developer' 
  | 'settings';

export interface CommandPaletteItem {
  id: string;
  title: string;
  description: string;
  category: 'Navigation' | 'Actions' | 'Developer' | 'Jarvis' | 'System';
  action: () => void;
  iconName: string;
  keywords?: string[];
}
