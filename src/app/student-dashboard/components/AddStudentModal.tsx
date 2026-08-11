'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { GENDER_OPTIONS } from '@/lib/mockData';
import type { Gender } from '@/lib/mockData';

interface AddStudentForm {
  name: string;
  grade: string;
  age: string;
  gender: Gender | '';
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
      <div className="card-elevated-md w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
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
          {/* Name */}
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

          {/* Grade */}
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

          {/* Age + Gender row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">
                Age <span className="text-negative">*</span>
              </label>
              <input
                className="input-mystic"
                type="number"
                min="5"
                max="25"
                placeholder="e.g. 14"
                {...register('age', {
                  required: 'Age is required',
                  min: { value: 5, message: 'Min age is 5' },
                  max: { value: 25, message: 'Max age is 25' },
                })}
              />
              {errors.age && (
                <p className="text-xs text-negative mt-1">{errors.age.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-600 text-foreground mb-1.5">
                Gender <span className="text-negative">*</span>
              </label>
              <select
                className="input-mystic"
                {...register('gender', { required: 'Gender is required' })}
              >
                <option value="">Select...</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={`gender-${g}`} value={g}>{g}</option>
                ))}
              </select>
              {errors.gender && (
                <p className="text-xs text-negative mt-1">{errors.gender.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
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
              placeholder="e.g. Strong communicator, needs support with structured thinking..."
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