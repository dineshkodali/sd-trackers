import React, { useState, useEffect } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { PropertyAsset, PropertyRoom } from '../../types/masterData';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  rooms: PropertyRoom[];
  assetToEdit?: PropertyAsset | null;
  onSuccess: () => void;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  rooms,
  assetToEdit,
  onSuccess
}) => {
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState('Furniture');
  const [roomId, setRoomId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<PropertyAsset['condition']>('Good');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [status, setStatus] = useState<PropertyAsset['status']>('Active');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (assetToEdit) {
        setAssetName(assetToEdit.assetName);
        setCategory(assetToEdit.category);
        setRoomId(assetToEdit.roomId || '');
        setSerialNumber(assetToEdit.serialNumber || '');
        setQuantity(assetToEdit.quantity || 1);
        setCondition(assetToEdit.condition || 'Good');
        setPurchaseDate(assetToEdit.purchaseDate || '');
        setWarrantyExpiry(assetToEdit.warrantyExpiry || '');
        setStatus(assetToEdit.status || 'Active');
        setNotes(assetToEdit.notes || '');
      } else {
        setAssetName('');
        setCategory('Furniture');
        setRoomId('');
        setSerialNumber('');
        setQuantity(1);
        setCondition('Good');
        setPurchaseDate('');
        setWarrantyExpiry('');
        setStatus('Active');
        setNotes('');
      }
      setErrorMsg('');
    }
  }, [isOpen, assetToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) {
      setErrorMsg('Asset name is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await suPropertyDetailsService.savePropertyAsset({
        id: assetToEdit?.id,
        propertyId,
        roomId: roomId || undefined,
        category,
        assetName: assetName.trim(),
        serialNumber: serialNumber.trim(),
        quantity: Number(quantity) || 1,
        condition,
        purchaseDate: purchaseDate || undefined,
        warrantyExpiry: warrantyExpiry || undefined,
        status,
        notes: notes.trim()
      });
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save asset.');
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
            <Package className="w-4 h-4 text-[#0d9488]" />
            <span>{assetToEdit ? 'Edit Asset' : 'Add Property Asset / Inventory'}</span>
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
              <label className="block text-neutral-600 font-medium mb-1">Asset Name *</label>
              <input
                type="text"
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
                required
                placeholder="e.g. Fridge, Double Bed"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="Furniture">Furniture (Bed, Desk, Chair)</option>
                <option value="Appliance">Appliance (Fridge, Microwave)</option>
                <option value="Fire Safety">Fire Safety (Blanket, Detector)</option>
                <option value="Electronics">Electronics (TV, Heater)</option>
                <option value="Fixtures">Fixtures &amp; Fittings</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Assigned Room</label>
              <select
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="">Communal / Property Wide</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.roomType})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Serial / Barcode"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Needs Replacement">Needs Replacement</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
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
                <option value="Active">Active</option>
                <option value="In Repair">In Repair</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e5e5]">
            <button type="button" onClick={onClose} className="px-3 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-600 hover:bg-neutral-100 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold hover:bg-teal-700 cursor-pointer shadow-xs">
              {isSubmitting ? 'Saving...' : assetToEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
