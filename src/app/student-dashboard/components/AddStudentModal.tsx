'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

interface AddStudentForm {
  name: string;
  grade: string;
  notes: string;
}

interface AddStudentModalProps {
  onClose: () => void;
  onAdd: (student: AddStudentForm) => void;
}

const GRADES = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
];

export default function AddStudentModal({ onClose, onAdd }: AddStudentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AddStudentForm>();

  const onSubmit = async (data: AddStudentForm) => {
    setIsLoading(true);
    // BACKEND INTEGRATION: POST /api/students to create new student profile
    await new Promise((r) => setTimeout(r, 900));
    setIsLoading(false);
    onAdd(data);
    toast.success(`${data.name} has been added to your roster.`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card-elevated-md w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="UserPlusIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-700 text-foreground text-base">Add New Student</h2>
              <p className="text-xs text-muted-foreground">Register a new student to your roster</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">
              Student Full Name <span className="text-negative">*</span>
            </label>
            <input
              className="input-mystic"
              placeholder="e.g. Arjun Mehta"
              {...register('name', { required: 'Student name is required' })}
            />
            {errors.name && (
              <p className="text-xs text-negative mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">
              Grade / Year <span className="text-negative">*</span>
            </label>
            <select
              className="input-mystic"
              {...register('grade', { required: 'Grade is required' })}
            >
              <option value="">Select grade...</option>
              {GRADES.map((g) => (
                <option key={`grade-${g}`} value={g}>{g}</option>
              ))}
            </select>
            {errors.grade && (
              <p className="text-xs text-negative mt-1">{errors.grade.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-600 text-foreground mb-1.5">
              Initial Notes
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Optional: any initial observations about this student
            </p>
            <textarea
              className="input-mystic resize-none"
              rows={3}
              placeholder="e.g. Strong in mathematics, needs support with reading comprehension..."
              {...register('notes')}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
              {isLoading ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Adding...</>
              ) : (
                <><Icon name="UserPlusIcon" size={15} /> Add Student</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}