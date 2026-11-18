import React from 'react';
import { EpistemicStatus, EpistemicValue } from '../types/survey';

const STATUS_OPTIONS: Array<{ value: EpistemicStatus; label: string }> = [
  { value: 'known', label: 'ระบุค่าจริง / ทราบค่า' },
  { value: 'unknown', label: 'ไม่ทราบ (Unknown)' },
  { value: 'not_inspected', label: 'ไม่ได้ตรวจ' },
  { value: 'not_applicable', label: 'ไม่เกี่ยวข้อง (N/A)' },
  { value: 'unsafe_to_inspect', label: 'ไม่ปลอดภัยที่จะตรวจ' },
  { value: 'requires_qualified_person', label: 'ต้องใช้ผู้มีคุณสมบัติ' },
];

interface EpistemicNumberFieldProps {
  label: string;
  unit?: string;
  field: EpistemicValue<number>;
  onChange: (next: EpistemicValue<number>) => void;
  disabled?: boolean;
  step?: string;
  placeholder?: string;
  safetySensitive?: boolean;
}

export const EpistemicNumberField: React.FC<EpistemicNumberFieldProps> = ({
  label,
  unit,
  field,
  onChange,
  disabled,
  step = 'any',
  placeholder = '0',
  safetySensitive = false,
}) => {
  const filteredOptions = safetySensitive
    ? STATUS_OPTIONS
    : STATUS_OPTIONS.filter(
        (o) => o.value !== 'unsafe_to_inspect' && o.value !== 'requires_qualified_person'
      );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label} {unit ? <span className="text-xs text-slate-500">({unit})</span> : null}
        </label>
        <select
          aria-label={`${label} สถานะข้อมูล`}
          disabled={disabled}
          value={field.status}
          onChange={(e) => {
            const status = e.target.value as EpistemicStatus;
            onChange({
              ...field,
              status,
              value: status === 'known' ? (field.value ?? 0) : null,
            });
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 min-h-[36px]"
        >
          {filteredOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {field.status === 'known' ? (
        <input
          type="number"
          step={step}
          disabled={disabled}
          value={field.value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({
              ...field,
              value: raw === '' ? null : Number(raw),
            });
          }}
          className="w-full px-3 py-2.5 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={field.note ?? ''}
          placeholder="ระบุเหตุผลหรือหมายเหตุเพิ่มเติม (ถ้ามี)..."
          onChange={(e) => onChange({ ...field, note: e.target.value })}
          className="w-full px-3 py-2 text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 min-h-[40px]"
        />
      )}
    </div>
  );
};

interface EpistemicTextFieldProps {
  label: string;
  field: EpistemicValue<string>;
  onChange: (next: EpistemicValue<string>) => void;
  disabled?: boolean;
  placeholder?: string;
  safetySensitive?: boolean;
}

export const EpistemicTextField: React.FC<EpistemicTextFieldProps> = ({
  label,
  field,
  onChange,
  disabled,
  placeholder = 'ระบุรายละเอียดที่ตรวจสอบได้...',
  safetySensitive = false,
}) => {
  const filteredOptions = safetySensitive
    ? STATUS_OPTIONS
    : STATUS_OPTIONS.filter(
        (o) => o.value !== 'unsafe_to_inspect' && o.value !== 'requires_qualified_person'
      );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
        <select
          aria-label={`${label} สถานะข้อมูล`}
          disabled={disabled}
          value={field.status}
          onChange={(e) => {
            const status = e.target.value as EpistemicStatus;
            onChange({
              ...field,
              status,
              value: status === 'known' ? (field.value ?? '') : null,
            });
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 min-h-[36px]"
        >
          {filteredOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {field.status === 'known' ? (
        <input
          type="text"
          disabled={disabled}
          value={field.value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-[44px]"
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={field.note ?? ''}
          placeholder="ระบุเหตุผลที่ยังไม่ทราบ / ไม่ปลอดภัย / รอผู้มีคุณสมบัติ..."
          onChange={(e) => onChange({ ...field, note: e.target.value })}
          className="w-full px-3 py-2 text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 min-h-[40px]"
        />
      )}
    </div>
  );
};

export function formatEpistemicValue<T>(
  field: EpistemicValue<T>,
  unit = ''
): string {
  switch (field.status) {
    case 'known':
      if (field.value === null || field.value === undefined || field.value === '') {
        return 'ระบุว่าทราบค่า แต่ยังไม่ได้กรอก';
      }
      if (typeof field.value === 'boolean') {
        return field.value ? 'มี / ใช่' : 'ไม่มี / ไม่ใช่';
      }
      return `${field.value}${unit ? ` ${unit}` : ''}`;
    case 'unknown':
      return `ไม่ทราบ${field.note ? ` (${field.note})` : ''}`;
    case 'not_inspected':
      return `ไม่ได้ตรวจ${field.note ? ` (${field.note})` : ''}`;
    case 'not_applicable':
      return `ไม่เกี่ยวข้อง${field.note ? ` (${field.note})` : ''}`;
    case 'unsafe_to_inspect':
      return `ไม่ปลอดภัยที่จะตรวจ${field.note ? ` (${field.note})` : ''}`;
    case 'requires_qualified_person':
      return `ต้องใช้ผู้มีคุณสมบัติ${field.note ? ` (${field.note})` : ''}`;
  }
}
