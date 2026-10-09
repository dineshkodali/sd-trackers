import React from 'react';
import { 
  HeartHandshake, 
  Soup, 
  Building2, 
  AlertTriangle, 
  Wrench, 
  MessageSquare, 
  FileText, 
  LifeBuoy, 
  MapPin, 
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { UnifiedActivityItem } from '../../types/masterData';

interface SUActivityTimelineProps {
  items: UnifiedActivityItem[];
  loading?: boolean;
}

export const SUActivityTimeline: React.FC<SUActivityTimelineProps> = ({ items, loading = false }) => {
  if (loading) {
    return (
      <div className="py-8 text-center text-xs text-neutral-500 animate-pulse flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-teal-600 animate-spin" />
        <span>Loading operational activity timeline...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center bg-white rounded-lg border border-dashed border-neutral-200">
        <Clock className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
        <p className="text-xs font-semibold text-neutral-700">No activity records yet</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          Operational records submitted for this service user will automatically appear here.
        </p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'Welfare Check':
        return <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />;
      case 'Food Survey':
        return <Soup className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Room Check':
        return <Building2 className="w-3.5 h-3.5 text-cyan-600" />;
      case 'Incident':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
      case 'Maintenance':
        return <Wrench className="w-3.5 h-3.5 text-amber-600" />;
      case 'Document':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'Support':
        return <LifeBuoy className="w-3.5 h-3.5 text-purple-600" />;
      case 'Placement':
        return <MapPin className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-neutral-600" />;
    }
  };

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
      {items.map(item => (
        <div key={item.id} className="relative group">
          {/* Dot Icon */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border border-neutral-300 shadow-xs flex items-center justify-center group-hover:border-teal-500 group-hover:scale-110 transition-transform">
            {getIcon(item.type)}
          </div>

          <div className="bg-white p-3 rounded-lg border border-neutral-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.badgeClass || 'bg-neutral-100 text-neutral-700'}`}>
                {item.type}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                <Calendar className="w-3 h-3 text-neutral-400" />
                <span>
                  {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown date'}
                </span>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-neutral-800">{item.title}</h4>
            {item.description && (
              <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">{item.description}</p>
            )}

            {(item.actor || item.status) && (
              <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
                {item.actor ? <span>Logged by: <strong className="text-neutral-600">{item.actor}</strong></span> : <span />}
                {item.status && <span className="font-semibold text-teal-700">{item.status}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
