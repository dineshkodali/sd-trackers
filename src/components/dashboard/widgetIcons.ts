import {
  AlertTriangle, BarChart3, Bell, Building2, Bus, ClipboardCheck, FileEdit, Hash, HardHat,
  LayoutGrid, Receipt, ShieldAlert, Shirt, Users, Utensils, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle, BarChart3, Bell, Building2, Bus, ClipboardCheck, FileEdit, Hash, HardHat,
  LayoutGrid, Receipt, ShieldAlert, Shirt, Users, Utensils, Zap,
};

export function widgetIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutGrid;
}
