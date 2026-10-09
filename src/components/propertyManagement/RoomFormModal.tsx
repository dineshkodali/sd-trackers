import React, { useState, useEffect } from 'react';
import { X, DoorOpen, Plus, AlertCircle } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { PropertyRoom } from '../../types/masterData';
import { useApp } from '../../context/AppContext';

interface RoomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  roomToEdit?: PropertyRoom | null;
  onSuccess: () => void;
}

export const RoomFormModal: React.FC<RoomFormModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  roomToEdit,
  onSuccess
}) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<PropertyRoom['roomType']>('Bedroom');
  const [floor, setFloor] = useState('Ground');
  const [capacity, setCapacity] = useState(1);
  const [size, setSize] = useState('');
  const [status, setStatus] = useState<PropertyRoom['status']>('Available');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { getFieldOptions } = useApp();
  const roomTypeOptions = React.useMemo(() => getFieldOptions('propertyRoomTypes', false), [getFieldOptions]);

  useEffect(() => {
    if (isOpen) {
      if (roomToEdit) {
        setRoomNumber(roomToEdit.roomNumber);
        setRoomName(roomToEdit.roomName || '');
        setRoomType(roomToEdit.roomType);
        setFloor(roomToEdit.floor || 'Ground');
        setCapacity(roomToEdit.capacity || 1);
        setSize(roomToEdit.size || '');
        setStatus(roomToEdit.status);
        setDescription(roomToEdit.description || '');
      } else {
        setRoomNumber('');
        setRoomName('');
        setRoomType('Bedroom');
        setFloor('Ground');
        setCapacity(1);
        setSize('');
        setStatus('Available');
        setDescription('');
      }
      setErrorMsg('');
    }
  }, [isOpen, roomToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setErrorMsg('Room number is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (roomToEdit) {
        const res = await suPropertyService.updateRoom(roomToEdit.id, {
          roomNumber: roomNumber.trim(),
          roomName: roomName.trim() || `Room ${roomNumber.trim()}`,
          roomType,
          floor,
          capacity: Number(capacity) || 1,
          size,
          status,
          description
        });
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to update room.');
        }
      } else {
        const res = await suPropertyService.createRoom({
          propertyId,
          roomNumber: roomNumber.trim(),
          roomName: roomName.trim() || `Room ${roomNumber.trim()}`,
          roomType,
          floor,
          capacity: Number(capacity) || 1,
          size,
          status,
          occupancyStatus: status,
          description
        });
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to create room.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xs shadow-2xl w-full max-w-md border border-[#e5e5e5] overflow-hidden text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8]">
          <h3 className="font-bold text-neutral-800 flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-[#0d9488]" />
            <span>{roomToEdit ? `Edit Room ${roomToEdit.roomNumber}` : 'Add Room to Property'}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xs border border-red-200 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Room Number *</label>
              <input
                type="text"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                required
                placeholder="e.g. 1A, 4, 12"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="e.g. Master Bedroom"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Room Type</label>
              <select
                value={roomType}
                onChange={e => setRoomType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                {roomTypeOptions.length > 0 ? (
                  roomTypeOptions.map(opt => (
                    <option key={opt.id} value={opt.value || opt.label}>{opt.label}</option>
                  ))
                ) : (
                  <>
                    <option value="Bedroom">Bedroom</option>
                    <option value="Living Room">Living Room</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bathroom">Bathroom</option>
                    <option value="Toilet">Toilet</option>
                    <option value="Office">Office</option>
                    <option value="Storage">Storage</option>
                    <option value="Other">Other</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Floor Level</label>
              <input
                type="text"
                value={floor}
                onChange={e => setFloor(e.target.value)}
                placeholder="e.g. Ground, 1st, 2nd"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Capacity (Beds)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Reserved">Reserved</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Unavailable">Unavailable</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-medium mb-1">Description &amp; Fixtures</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Double glazed, radiator heating, en-suite"
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e5e5]">
            <button type="button" onClick={onClose} className="px-3 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-600 hover:bg-neutral-100 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold hover:bg-teal-700 cursor-pointer shadow-xs">
              {isSubmitting ? 'Saving...' : roomToEdit ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
