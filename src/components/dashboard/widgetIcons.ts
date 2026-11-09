import { IconAlertTriangle as AlertTriangle, IconChartBar as BarChart3, IconBell as Bell, IconBuilding as Building2, IconBus as Bus, IconClipboardCheck as ClipboardCheck, IconFilePencil as FileEdit, IconHash as Hash, IconHelmet as HardHat, IconLayoutGrid as LayoutGrid, IconReceipt as Receipt, IconShieldExclamation as ShieldAlert, IconShirt as Shirt, IconUsers as Users, IconToolsKitchen2 as Utensils, IconBolt as Zap, type Icon as TablerIcon } from '@tabler/icons-react';

const ICONS: Record<string, TablerIcon> = {
  AlertTriangle, BarChart3, Bell, Building2, Bus, ClipboardCheck, FileEdit, Hash, HardHat,
  LayoutGrid, Receipt, ShieldAlert, Shirt, Users, Utensils, Zap,
};

export function widgetIcon(name: string): TablerIcon {
  return ICONS[name] ?? LayoutGrid;
}
