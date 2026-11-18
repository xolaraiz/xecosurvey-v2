import React, { useRef, useState } from 'react';
import {
  AlertOctagon,
  Camera,
  Circle,
  Grid,
  MoveUpRight,
  Plus,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import {
  EvidenceFile,
  EvidenceMarkupAnnotation,
  SolarSurveyProject,
} from '../../types/survey';

interface EvidenceMarkupSectionProps {
  project: SolarSurveyProject;
  readOnly: boolean;
  onUpdate: (nextFiles: EvidenceFile[], auditDetail: string) => void;
}

const CATEGORIES: EvidenceFile['category'][] = [
  'Building Overview',
  'Site Access',
  'Roof & Obstacles',
  'Meter & MDB (Safe View)',
  'Inverter & Route',
  'Hazard / Restriction',
  'SLD / Drawing / Sketch',
  'Before/After Reference Angle',
];

export const EvidenceMarkupSection: React.FC<EvidenceMarkupSectionProps> = ({
  project,
  readOnly,
  onUpdate,
}) => {
  const [selectedId, setSelectedId] = useState<string>(project.evidenceFiles[0]?.id ?? '');
  const [tool, setTool] = useState<'arrow' | 'circle' | 'panel_zone' | 'text'>('panel_zone');
  const [labelInput, setLabelInput] = useState('จุดสังเกต / แนวแผง');
  const [color, setColor] = useState('#F59E0B');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // New evidence form state
  const [newCategory, setNewCategory] = useState<EvidenceFile['category']>('Building Overview');
  const [newTitle, setNewTitle] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newNotToScale, setNewNotToScale] = useState(true);
  const [newUnableSafe, setNewUnableSafe] = useState(false);
  const [newUnsafeReason, setNewUnsafeReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedFile = project.evidenceFiles.find((f) => f.id === selectedId) ?? project.evidenceFiles[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || readOnly) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      const isPdf = file.type === 'application/pdf';
      const created: EvidenceFile = {
        id: `ev-${Date.now()}`,
        projectId: project.id,
        category: newCategory,
        title: newTitle.trim() || file.name,
        caption: newCaption.trim() || 'แนบไฟล์หลักฐานหน้างาน',
        unableToCaptureSafely: false,
        originalDataUrl: dataUrl,
        annotations: [],
        isNotToScaleSketch: newNotToScale,
        recordedAt: new Date().toISOString(),
        recordedBy: project.assignedSurveyor,
        gpsLat: project.site.gpsConsentGranted ? project.site.gpsLat : undefined,
        gpsLng: project.site.gpsConsentGranted ? project.site.gpsLng : undefined,
        fileType: isPdf ? 'pdf' : 'image',
      };
      const next = [created, ...project.evidenceFiles];
      onUpdate(next, `เพิ่มหลักฐาน "${created.title}" (${created.category})`);
      setSelectedId(created.id);
      setNewTitle('');
      setNewCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRecordUnsafeNoPhoto = () => {
    if (readOnly || !newUnsafeReason.trim()) return;
    const created: EvidenceFile = {
      id: `ev-${Date.now()}`,
      projectId: project.id,
      category: newCategory,
      title: newTitle.trim() || `บันทึกเหตุผลที่ไม่สามารถถ่ายภาพ (${newCategory})`,
      caption: newCaption.trim(),
      unableToCaptureSafely: true,
      unsafeReason: newUnsafeReason.trim(),
      annotations: [],
      isNotToScaleSketch: false,
      recordedAt: new Date().toISOString(),
      recordedBy: project.assignedSurveyor,
      fileType: 'image',
    };
    const next = [created, ...project.evidenceFiles];
    onUpdate(next, `บันทึกข้อจำกัดการถ่ายภาพอย่างปลอดภัย: ${created.unsafeReason}`);
    setSelectedId(created.id);
    setNewTitle('');
    setNewCaption('');
    setNewUnsafeReason('');
    setNewUnableSafe(false);
  };

  const getNormalizedCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !selectedFile || selectedFile.fileType === 'pdf') return;
    const pt = getNormalizedCoords(e);
    if (tool === 'text') {
      const ann: EvidenceMarkupAnnotation = {
        id: `ann-${Date.now()}`,
        type: 'text',
        x1: pt.x,
        y1: pt.y,
        label: labelInput.trim() || 'หมายเหตุ',
        color,
      };
      const next = project.evidenceFiles.map((f) =>
        f.id === selectedFile.id ? { ...f, annotations: [...f.annotations, ann] } : f
      );
      onUpdate(next, `เพิ่มคำอธิบาย Markup บนภาพ "${selectedFile.title}"`);
      return;
    }
    setDragStart(pt);
  };

  const handleSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !dragStart || !selectedFile) return;
    const end = getNormalizedCoords(e);
    const dist = Math.hypot(end.x - dragStart.x, end.y - dragStart.y);
    const x2 = dist < 0.02 ? Math.min(0.95, dragStart.x + 0.14) : end.x;
    const y2 = dist < 0.02 ? Math.min(0.95, dragStart.y + 0.1) : end.y;

    const ann: EvidenceMarkupAnnotation = {
      id: `ann-${Date.now()}`,
      type: tool,
      x1: dragStart.x,
      y1: dragStart.y,
      x2,
      y2,
      label: tool === 'panel_zone' || tool === 'circle' ? labelInput.trim() || undefined : undefined,
      color,
    };
    const next = project.evidenceFiles.map((f) =>
      f.id === selectedFile.id ? { ...f, annotations: [...f.annotations, ann] } : f
    );
    onUpdate(next, `วาด Markup (${tool}) บนภาพ "${selectedFile.title}" โดยเก็บภาพต้นฉบับแยกไว้`);
    setDragStart(null);
  };

  const handleUndoAnnotation = () => {
    if (readOnly || !selectedFile || selectedFile.annotations.length === 0) return;
    const next = project.evidenceFiles.map((f) =>
      f.id === selectedFile.id
        ? { ...f, annotations: f.annotations.slice(0, -1) }
        : f
    );
    onUpdate(next, `ย้อนกลับ Markup ล่าสุดบน "${selectedFile.title}"`);
  };

  const handleDeleteFile = (id: string) => {
    if (readOnly) return;
    const next = project.evidenceFiles.filter((f) => f.id !== id);
    onUpdate(next, 'ลบไฟล์หลักฐานออกจากโครงการ');
    if (selectedId === id) setSelectedId(next[0]?.id ?? '');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            G. ภาพถ่าย แผนผัง และหลักฐานหน้างาน (แยกต้นฉบับจาก Markup)
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            ระบบเก็บไฟล์ภาพต้นฉบับแยกจากเลเยอร์ Markup เสมอ · การวางแนวแผงบนภาพหรือ Sketch เป็นภาพประกอบเบื้องต้น (“ไม่ใช่แบบตามมาตราส่วน”) ห้ามใช้เป็นแบบก่อสร้าง
          </p>
        </div>

        {!readOnly && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  หมวดหมู่หลักฐาน
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as EvidenceFile['category'])}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อภาพ / หัวข้อหลักฐาน
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น ตู้ MDB ชั้น 1 (ถ่ายจากด้านนอก)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  คำอธิบายข้อสังเกต
                </label>
                <input
                  type="text"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="รายละเอียดมุมถ่าย หรือสิ่งกีดขวาง..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newNotToScale}
                    onChange={(e) => setNewNotToScale(e.target.checked)}
                  />
                  ติดป้าย “ไม่ใช่แบบตามมาตราส่วน” (สำหรับภาพ Sketch/จัดวางแผงคร่าว ๆ)
                </label>
                <label className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                  <input
                    type="checkbox"
                    checked={newUnableSafe}
                    onChange={(e) => setNewUnableSafe(e.target.checked)}
                  />
                  ไม่สามารถถ่ายภาพอย่างปลอดภัย
                </label>
              </div>

              {!newUnableSafe && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="evidence-upload-input"
                  />
                  <label
                    htmlFor="evidence-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 cursor-pointer min-h-[40px]"
                  >
                    <Camera className="w-4 h-4" />
                    ถ่ายภาพ / อัปโหลดรูปหรือ PDF
                  </label>
                </div>
              )}
            </div>

            {newUnableSafe && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={newUnsafeReason}
                  onChange={(e) => setNewUnsafeReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ไม่สามารถเก็บภาพได้อย่างปลอดภัย (เช่น หลังคาเปราะ/ห้ามเข้าเขตเครื่องจักร/ไม่มีผู้เปิดตู้ไฟ)..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={handleRecordUnsafeNoPhoto}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white min-h-[40px] shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  บันทึกข้อยกเว้นความปลอดภัย
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evidence Split Viewer + Markup Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
            รายการหลักฐาน ({project.evidenceFiles.length})
          </div>
          {project.evidenceFiles.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 text-center">
              ยังไม่มีภาพถ่ายหรือบันทึกหลักฐาน กรุณาอัปโหลดหรือบันทึกเหตุผลที่ไม่สามารถถ่ายภาพได้อย่างปลอดภัย
            </div>
          ) : (
            project.evidenceFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedId(file.id)}
                className={`p-3.5 cursor-pointer transition-colors space-y-1 ${
                  selectedFile?.id === file.id
                    ? 'bg-amber-50/80 dark:bg-amber-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {file.category}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      aria-label="ลบหลักฐาน"
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {file.title}
                </div>
                {file.unableToCaptureSafely ? (
                  <div className="text-[11px] text-red-700 dark:text-red-400 flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3 shrink-0" />
                    <span>งดถ่ายภาพเพื่อความปลอดภัย</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Markup: {file.annotations.length} จุด · {file.recordedAt.slice(0, 10)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right Canvas */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          {!selectedFile ? (
            <div className="py-12 text-center text-xs text-slate-500">
              เลือกรายการหลักฐานทางซ้ายเพื่อดูภาพต้นฉบับและเครื่องมือ Markup
            </div>
          ) : selectedFile.unableToCaptureSafely ? (
            <div className="p-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 space-y-2">
              <div className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4" />
                ไม่สามารถเก็บภาพถ่ายได้อย่างปลอดภัย
              </div>
              <p className="text-xs text-red-700 dark:text-red-200">
                <strong>เหตุผลหน้างาน:</strong> {selectedFile.unsafeReason}
              </p>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                ผู้บันทึก: {selectedFile.recordedBy} · เวลา: {selectedFile.recordedAt}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedFile.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedFile.caption} · ผู้บันทึก: {selectedFile.recordedBy}
                    {selectedFile.isNotToScaleSketch ? ' · ไม่ใช่แบบตามมาตราส่วน (Not to Scale)' : ''}
                  </p>
                </div>

                {!readOnly && selectedFile.fileType !== 'pdf' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTool('panel_zone')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border ${
                        tool === 'panel_zone'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      วางแนวแผงคร่าว ๆ
                    </button>
                    <button
                      type="button"
                      onClick={() => setTool('arrow')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border ${
                        tool === 'arrow'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <MoveUpRight className="w-3.5 h-3.5" />
                      ลูกศร
                    </button>
                    <button
                      type="button"
                      onClick={() => setTool('circle')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border ${
                        tool === 'circle'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Circle className="w-3.5 h-3.5" />
                      วงกลม
                    </button>
                    <button
                      type="button"
                      onClick={() => setTool('text')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border ${
                        tool === 'text'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      ข้อความ
                    </button>
                    <button
                      type="button"
                      onClick={handleUndoAnnotation}
                      disabled={selectedFile.annotations.length === 0}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      ย้อนกลับ
                    </button>
                  </div>
                )}
              </div>

              {!readOnly && selectedFile.fileType !== 'pdf' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="ข้อความกำกับ Markup..."
                    className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex-1 min-w-[200px]"
                  />
                  <div className="flex items-center gap-1.5">
                    <span>สี:</span>
                    {['#F59E0B', '#EF4444', '#38BDF8', '#10B981'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`เลือกสี ${c}`}
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    ลากบนภาพเพื่อวาดกรอบ/ลูกศร หรือคลิกเพื่อวางข้อความ
                  </span>
                </div>
              )}

              {selectedFile.fileType === 'pdf' ? (
                <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    เอกสาร PDF แนบ: {selectedFile.title}
                  </p>
                  {selectedFile.originalDataUrl && (
                    <a
                      href={selectedFile.originalDataUrl}
                      download={selectedFile.title}
                      className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                    >
                      ดาวน์โหลดไฟล์ PDF ต้นฉบับ
                    </a>
                  )}
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 select-none">
                  <img
                    src={selectedFile.originalDataUrl}
                    alt={selectedFile.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto block"
                  />
                  <svg
                    viewBox="0 0 1000 650"
                    preserveAspectRatio="none"
                    onMouseDown={handleSvgMouseDown}
                    onMouseUp={handleSvgMouseUp}
                    className={`absolute inset-0 w-full h-full ${readOnly ? '' : 'cursor-crosshair'}`}
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="8"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                      </marker>
                    </defs>
                    {selectedFile.annotations.map((ann) => {
                      const x1 = ann.x1 * 1000;
                      const y1 = ann.y1 * 650;
                      const x2 = (ann.x2 ?? ann.x1 + 0.1) * 1000;
                      const y2 = (ann.y2 ?? ann.y1 + 0.1) * 650;
                      if (ann.type === 'panel_zone') {
                        const rx = Math.min(x1, x2);
                        const ry = Math.min(y1, y2);
                        const rw = Math.max(24, Math.abs(x2 - x1));
                        const rh = Math.max(24, Math.abs(y2 - y1));
                        return (
                          <g key={ann.id}>
                            <rect
                              x={rx}
                              y={ry}
                              width={rw}
                              height={rh}
                              fill="rgba(245, 158, 11, 0.22)"
                              stroke={ann.color}
                              strokeWidth="3"
                              strokeDasharray="8 4"
                            />
                            {ann.label && (
                              <text
                                x={rx + 6}
                                y={ry + 22}
                                fill="#FFFFFF"
                                fontSize="16"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'circle') {
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2;
                        const r = Math.max(18, Math.hypot(x2 - x1, y2 - y1) / 2);
                        return (
                          <g key={ann.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill="rgba(239, 68, 68, 0.15)"
                              stroke={ann.color}
                              strokeWidth="3.5"
                            />
                            {ann.label && (
                              <text
                                x={cx}
                                y={cy - r - 8}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize="16"
                                fontWeight="bold"
                              >
                                {ann.label}
                              </text>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'arrow') {
                        return (
                          <line
                            key={ann.id}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={ann.color}
                            strokeWidth="4"
                            markerEnd="url(#arrowhead)"
                          />
                        );
                      }
                      return (
                        <text
                          key={ann.id}
                          x={x1}
                          y={y1}
                          fill={ann.color}
                          fontSize="18"
                          fontWeight="bold"
                        >
                          {ann.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
