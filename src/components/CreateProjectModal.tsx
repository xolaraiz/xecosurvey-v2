import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Franchise, ProjectType, SolarSurveyProject, SystemTopology } from '../types/survey';
import { createBlankProject } from '../lib/demoData';

interface CreateProjectModalProps {
  franchises: Franchise[];
  defaultFranchiseId: string;
  onClose: () => void;
  onCreate: (project: SolarSurveyProject) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  franchises,
  defaultFranchiseId,
  onClose,
  onCreate,
}) => {
  const initialFranchise =
    defaultFranchiseId === 'ALL' ? franchises[0]?.id ?? 'BKK-01' : defaultFranchiseId;

  const [franchiseId, setFranchiseId] = useState(initialFranchise);
  const [projectType, setProjectType] = useState<ProjectType>('Residential');
  const [topology, setTopology] = useState<SystemTopology>('On-grid');
  const [customerName, setCustomerName] = useState('');
  const [province, setProvince] = useState('กรุงเทพมหานคร');
  const [utilityProvider, setUtilityProvider] = useState<'MEA' | 'PEA' | 'Other'>('MEA');
  const [assignedSurveyor, setAssignedSurveyor] = useState('นายธนกร วิริยะ (Surveyor)');
  const [assignedEngineer, setAssignedEngineer] = useState('นายปิยะวัฒน์ กาญจนกุล (วศ.บ. ไฟฟ้า)');
  const [scheduledSurveyDate, setScheduledSurveyDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('กรุณาระบุชื่อโครงการหรือชื่อลูกค้า');
      return;
    }
    const created = createBlankProject({
      franchiseId,
      projectType,
      topology,
      customerName: customerName.trim(),
      province: province.trim() || 'ไม่ระบุจังหวัด',
      utilityProvider,
      assignedSurveyor: assignedSurveyor.trim() || 'ผู้สำรวจภาคสนาม',
      assignedEngineer: assignedEngineer.trim() || 'รอระบุวิศวกรตรวจทาน',
      scheduledSurveyDate,
    });
    onCreate(created);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              สร้างโครงการสำรวจใหม่
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กำหนดสาขา ประเภทอาคาร และรูปแบบระบบเพื่อสร้างแบบฟอร์มสำรวจที่เหมาะสม
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                สาขา / Master Franchise
              </label>
              <select
                value={franchiseId}
                onChange={(e) => setFranchiseId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              >
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                วันที่นัดหมายสำรวจ
              </label>
              <input
                type="date"
                value={scheduledSurveyDate}
                onChange={(e) => setScheduledSurveyDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ชื่อโครงการ / ชื่อลูกค้า <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="เช่น บ้านพักอาศัย คุณสมชาย / โรงงาน บจก. ตัวอย่าง"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ประเภทโครงการ
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Residential', 'C&I'] as ProjectType[]).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setProjectType(pt)}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors min-h-[44px] ${
                      projectType === pt
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {pt === 'Residential' ? 'Residential (บ้าน)' : 'C&I (พาณิชย์/โรงงาน)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                รูปแบบระบบที่สำรวจ
              </label>
              <select
                value={topology}
                onChange={(e) => setTopology(e.target.value as SystemTopology)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              >
                <option value="On-grid">On-grid (ไม่สำรองไฟ)</option>
                <option value="Hybrid">Hybrid (มีแบตเตอรี่สำรองไฟ)</option>
                <option value="On-grid + BESS Ready">On-grid + เตรียมพร้อม BESS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                เขตการไฟฟ้า
              </label>
              <select
                value={utilityProvider}
                onChange={(e) => setUtilityProvider(e.target.value as 'MEA' | 'PEA' | 'Other')}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              >
                <option value="MEA">กฟน. (MEA)</option>
                <option value="PEA">กฟภ. (PEA)</option>
                <option value="Other">อื่น ๆ (เช่น นิคมอุตสาหกรรม/เอกชน)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                จังหวัด
              </label>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ผู้สำรวจที่รับผิดชอบ
              </label>
              <input
                type="text"
                value={assignedSurveyor}
                onChange={(e) => setAssignedSurveyor(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                วิศวกรไฟฟ้าผู้ตรวจทาน
              </label>
              <input
                type="text"
                value={assignedEngineer}
                onChange={(e) => setAssignedEngineer(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 min-h-[44px]"
            >
              สร้างและเริ่มสำรวจ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
