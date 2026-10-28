import React from 'react';

/**
 * Long free text in a table cell (circumstances, comments, notes) is cut to one line with an ellipsis, so every row stays
 * the same height. The full text is in the hover tooltip and in the record's view window.
 */
export const ClampedText: React.FC<{ text: string; maxWidthClass?: string }> = ({ text, maxWidthClass = 'max-w-[260px]' }) => (
  <span className={`block ${maxWidthClass} truncate`} title={text.length > 40 ? text : undefined}>{text}</span>
);
