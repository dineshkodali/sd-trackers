import React, { useRef } from 'react';
import { Plus, Trash2, DoorOpen, UploadCloud, FileText } from 'lucide-react';

export interface RoomSetupItem {
  id: string;
  roomNumber: string;
  roomName: string;
  floor: string;
  roomType: 'Bedroom' | 'Living Room' | 'Kitchen' | 'Bathroom' | 'Other';
  capacity: number;
}

export interface InitialDocItem {
  documentType: string;
  documentName: string;
  referenceNumber: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
}

/* -------------------------------------------------------------------------- */
/* Section: Initial Quick Rooms Setup                                         */
/* -------------------------------------------------------------------------- */
export const PropertyRoomsSetupSection: React.FC<{
  initialRooms: RoomSetupItem[];
  setInitialRooms: React.Dispatch<React.SetStateAction<RoomSetupItem[]>>;
  onAutoGenerate: () => void;
}> = ({ initialRooms, setInitialRooms, onAutoGenerate }) => {
  const handleAddRoom = () => {
    const nextNum = initialRooms.length + 1;
    setInitialRooms(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        roomNumber: String(nextNum),
        roomName: `Room ${nextNum}`,
        floor: 'Ground',
        roomType: 'Bedroom',
        capacity: 1
      }
    ]);
  };

  const handleUpdate = (idx: number, field: keyof RoomSetupItem, val: any) => {
    setInitialRooms(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const handleRemove = (idx: number) => {
    setInitialRooms(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
        <div>
          <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
            <DoorOpen className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Initial Rooms Configuration ({initialRooms.length} Rooms)</span>
          </h4>
          <p className="text-[11px] text-neutral-500">Auto-create rooms for immediate occupancy allocation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAutoGenerate}
            className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-xs text-[11px] font-semibold hover:bg-teal-100 cursor-pointer"
          >
            Auto-Generate Rooms
          </button>
          <button
            type="button"
            onClick={handleAddRoom}
            className="px-2.5 py-1 bg-[#0d9488] text-white rounded-xs text-[11px] font-semibold hover:bg-[#0f766e] flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {initialRooms.length === 0 ? (
        <p className="text-neutral-400 italic text-[11px] py-4 text-center">
          No rooms configured. Click "Auto-Generate Rooms" to create rooms based on bedroom count.
        </p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {initialRooms.map((rm, idx) => (
            <div key={rm.id || idx} className="grid grid-cols-12 gap-2 bg-white p-2 rounded-xs border border-[#e5e5e5] items-center">
              <div className="col-span-3">
                <input
                  type="text"
                  placeholder="Room #"
                  value={rm.roomNumber}
                  onChange={e => handleUpdate(idx, 'roomNumber', e.target.value)}
                  className="w-full px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs font-semibold focus:border-[#0d9488] outline-hidden"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={rm.floor}
                  onChange={e => handleUpdate(idx, 'floor', e.target.value)}
                  className="w-full px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
                >
                  <option value="Ground">Ground Floor</option>
                  <option value="First">1st Floor</option>
                  <option value="Second">2nd Floor</option>
                  <option value="Third">3rd Floor</option>
                </select>
              </div>
              <div className="col-span-3">
                <select
                  value={rm.roomType}
                  onChange={e => handleUpdate(idx, 'roomType', e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
                >
                  <option value="Bedroom">Bedroom</option>
                  <option value="Living Room">Living Room</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={1}
                  title="Bed Capacity"
                  placeholder="Beds"
                  value={rm.capacity}
                  onChange={e => handleUpdate(idx, 'capacity', Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-center font-bold text-teal-800 focus:border-[#0d9488] outline-hidden"
                />
              </div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Section: Initial Document Attachment                                       */
/* -------------------------------------------------------------------------- */
export const PropertyDocumentsUploadSection: React.FC<{
  initialDocs: InitialDocItem[];
  setInitialDocs: React.Dispatch<React.SetStateAction<InitialDocItem[]>>;
}> = ({ initialDocs, setInitialDocs }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePicked = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setInitialDocs(prev => [
        ...prev,
        {
          documentType: 'Tenancy / Lease Agreement',
          documentName: file.name.replace(/\.[^/.]+$/, ''),
          referenceNumber: '',
          fileUrl: reader.result as string,
          fileName: file.name,
          fileSize: file.size
        }
      ]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
        <div>
          <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
            <UploadCloud className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Attach Initial Certificates &amp; Documents</span>
          </h4>
          <p className="text-[11px] text-neutral-500">Upload lease agreements, gas safety, EICR, EPC, or insurance</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1 bg-[#0d9488] text-white rounded-xs text-[11px] font-semibold hover:bg-[#0f766e] flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Attach File</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files && e.target.files[0]) handleFilePicked(e.target.files[0]);
          }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
        />
      </div>

      {initialDocs.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="p-4 border border-dashed border-[#e5e5e5] rounded-xs text-center cursor-pointer hover:border-[#0d9488] bg-white transition-colors"
        >
          <UploadCloud className="w-6 h-6 mx-auto text-neutral-400 mb-1" />
          <p className="text-xs font-semibold text-neutral-700">Click to attach property documents or certificates</p>
          <p className="text-[10px] text-neutral-400">PDF, JPG, DOC up to 20MB</p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialDocs.map((doc, idx) => (
            <div key={idx} className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5 truncate">
                <FileText className="w-5 h-5 text-[#0d9488] shrink-0" />
                <div className="truncate">
                  <p className="font-semibold text-xs text-[#242424] truncate">{doc.fileName}</p>
                  <p className="text-[10px] text-neutral-400">{doc.documentType}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInitialDocs(prev => prev.filter((_, i) => i !== idx))}
                className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
