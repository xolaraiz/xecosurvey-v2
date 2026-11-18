import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Plus, AlertCircle } from 'lucide-react';
import { ReferenceCategory, StandardReference, UserRole } from '../types/survey';
import { getRolePermissions } from '../lib/rbac';

interface StandardsRegistryViewProps {
  standards: StandardReference[];
  activeRole: UserRole;
  onSaveStandards: (next: StandardReference[]) => void;
}

const CATEGORY_LABELS: Record<ReferenceCategory, string> = {
  standard_requirement: 'ข้อกำหนดมาตรฐาน (วสท. / กฟน. / กฟภ. / กฎหมายอาคารและอัคคีภัย)',
  manufacturer_manual: 'คู่มือผู้ผลิตอุปกรณ์ (Manufacturer Manual)',
  brand_practice: 'แนวปฏิบัติของแบรนด์ (XOLARAIZ™ / XECO / CriXisZafe™)',
  field_observation: 'ข้อสังเกตหน้างาน (Field Observation Baseline)',
};

export const StandardsRegistryView: React.FC<StandardsRegistryViewProps> = ({
  standards,
  activeRole,
  onSaveStandards,
}) => {
  const perms = getRolePermissions(activeRole);
  const [filterCat, setFilterCat] = useState<'ALL' | ReferenceCategory>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newDocName, setNewDocName] = useState('');
  const [newCategory, setNewCategory] = useState<ReferenceCategory>('standard_requirement');
  const [newEdition, setNewEdition] = useState('ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ');
  const [newClause, setNewClause] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newReviewer, setNewReviewer] = useState('วิศวกรไฟฟ้ากลาง (Master HQ)');
  const [newVerified, setNewVerified] = useState(false);

  const filtered = standards.filter((s) => filterCat === 'ALL' || s.category === filterCat);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    const item: StandardReference = {
      id: `std-${Date.now()}`,
      category: newCategory,
      documentName: newDocName.trim(),
      editionOrYear: newEdition.trim() || 'ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ',
      clause: newClause.trim() || 'ระบุเลขข้อหลังตรวจสอบฉบับจริง',
      source: newSource.trim() || 'ระบุแหล่งอ้างอิง',
      summary: newSummary.trim() || '-',
      lastVerifiedDate: new Date().toISOString().slice(0, 10),
      reviewerName: newReviewer.trim() || 'Master Admin',
      verified: newVerified,
      applicableTo: ['Residential', 'C&I'],
    };
    onSaveStandards([item, ...standards]);
    setNewDocName('');
    setNewClause('');
    setNewSource('');
    setNewSummary('');
    setShowAddForm(false);
  };

  const handleToggleVerify = (id: string) => {
    if (!perms.canManageStandards) return;
    onSaveStandards(
      standards.map((s) =>
        s.id === id
          ? {
              ...s,
              verified: !s.verified,
              lastVerifiedDate: new Date().toISOString().slice(0, 10),
            }
          : s
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ทะเบียนมาตรฐาน เอกสารอ้างอิง และแนวปฏิบัติ XOLARAIZ™
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              แยกแยะชัดเจนระหว่าง “ข้อกำหนดมาตรฐาน” “คู่มือผู้ผลิต” “แนวปฏิบัติของแบรนด์” และ “ข้อสังเกตหน้างาน” —
              ระบบจะไม่แต่งเลขข้อหรือปีฉบับเอง และจะแสดง “ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ” หากยังไม่ได้ยืนยันฉบับจริง
            </p>
          </div>
          {perms.canManageStandards && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              เพิ่มเอกสารอ้างอิง (Master Admin)
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setFilterCat('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterCat === 'ALL'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            ทั้งหมด ({standards.length})
          </button>
          {(['standard_requirement', 'manufacturer_manual', 'brand_practice', 'field_observation'] as ReferenceCategory[]).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filterCat === cat
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat === 'standard_requirement'
                  ? 'ข้อกำหนดมาตรฐาน'
                  : cat === 'manufacturer_manual'
                  ? 'คู่มือผู้ผลิต'
                  : cat === 'brand_practice'
                  ? 'แนวปฏิบัติแบรนด์'
                  : 'ข้อสังเกตหน้างาน'}
              </button>
            )
          )}
        </div>
      </div>

      {showAddForm && perms.canManageStandards && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            เพิ่มรายการมาตรฐานหรือเอกสารอ้างอิงใหม่
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                หมวดหมู่
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ReferenceCategory)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                ชื่อเอกสาร *
              </label>
              <input
                type="text"
                required
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="ระบุชื่อเอกสารจริง..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                ฉบับ / ปี (หากยังไม่ตรวจฉบับจริง ให้คงค่าเริ่มต้นไว้)
              </label>
              <input
                type="text"
                value={newEdition}
                onChange={(e) => setNewEdition(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                เลขข้อ (ถ้ามี)
              </label>
              <input
                type="text"
                value={newClause}
                onChange={(e) => setNewClause(e.target.value)}
                placeholder="ระบุเฉพาะเลขข้อที่ตรวจสอบจากเอกสารจริง..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                แหล่งอ้างอิง / หน่วยงาน
              </label>
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                ผู้ตรวจทานเอกสาร
              </label>
              <input
                type="text"
                value={newReviewer}
                onChange={(e) => setNewReviewer(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              สรุปขอบเขตการใช้งานในการสำรวจ
            </label>
            <textarea
              rows={2}
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={newVerified}
              onChange={(e) => setNewVerified(e.target.checked)}
              className="w-4 h-4"
            />
            ยืนยันว่าผู้ตรวจทานได้เทียบกับเอกสารฉบับที่ใช้บังคับจริงแล้ว
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
            >
              บันทึกเข้าทะเบียนกลาง
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {filtered.map((item) => (
          <div key={item.id} className="p-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span aria-hidden="true"> · </span>
                <span>แหล่งที่มา: {item.source}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ตรวจทานเอกสารแล้ว ({item.lastVerifiedDate})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ
                  </span>
                )}
                {perms.canManageStandards && (
                  <button
                    type="button"
                    onClick={() => handleToggleVerify(item.id)}
                    className="text-xs underline text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    {item.verified ? 'ยกเลิกสถานะยืนยัน' : 'ทำเครื่องหมายว่าตรวจฉบับจริงแล้ว'}
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {item.documentName}
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
              <span>ฉบับ/ปี: {item.editionOrYear}</span>
              <span>เลขข้อ/หัวข้อ: {item.clause}</span>
              <span>ผู้ตรวจทาน: {item.reviewerName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
