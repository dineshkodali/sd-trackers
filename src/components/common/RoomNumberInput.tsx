import React from 'react';
import { useSiteRooms } from '../../hooks/useSiteRooms';

interface RoomNumberInputProps {
  name: string;
  /** Property or site the room belongs to; its registered rooms fill the dropdown. */
  site: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Room number for plain (uncontrolled) forms: a dropdown of the property's registered rooms,
 * or a text box when the property has none on record. A saved room that is no longer listed stays selectable.
 */
export const RoomNumberInput: React.FC<RoomNumberInputProps> = ({ name, site, defaultValue = '', required, placeholder, className }) => {
  const rooms = useSiteRooms(site);

  if (rooms.length === 0) {
    return <input type="text" name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} className={className} />;
  }

  return (
    <select key={site} name={name} defaultValue={defaultValue} required={required} className={className}>
      <option value="">Select room...</option>
      {defaultValue && !rooms.some(room => room.value === defaultValue) && <option value={defaultValue}>{defaultValue}</option>}
      {rooms.map(room => (
        <option key={`${room.propertyName}-${room.value}`} value={room.value}>{room.label}</option>
      ))}
    </select>
  );
};
