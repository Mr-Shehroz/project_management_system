// src/app/dashboard/editable-field.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

type EditableFieldProps = {
  value: string;
  onSave: (newValue: string) => void;
  fieldType: 'title' | 'description';
  canEdit: boolean;
};

export default function EditableField({
  value,
  onSave,
  fieldType,
  canEdit,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (canEdit) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (fieldType === 'title' && editValue.trim() === '') {
      alert('Title cannot be empty');
      return;
    }
    
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    if (fieldType === 'title') {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full font-semibold text-gray-800 dark:text-white border-b-2 border-blue-500 focus:outline-none bg-transparent"
        />
      );
    } else {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full text-sm text-gray-600 dark:text-gray-300 border-b-2 border-blue-500 focus:outline-none bg-transparent resize-none"
        />
      );
    }
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`${
        fieldType === 'title' 
          ? 'font-semibold text-gray-800 dark:text-white' 
          : 'text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2'
      } ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-600 rounded px-1' : 'cursor-default'}`}
    >
      {value || (fieldType === 'description' ? 'No description' : '')}
    </div>
  );
}