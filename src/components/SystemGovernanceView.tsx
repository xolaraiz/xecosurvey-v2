import React, { useEffect, useState } from 'react';
import { Database, Download, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { StorageHealthInfo, surveyRepository } from '../lib/repository';
import { UserRole } from '../types/survey';
import { getRolePermissions } from '../lib/rbac';

interface SystemGovernanceViewProps {
  activeRole: UserRole;
  onDataReset: () => void;
}

export const SystemGovernanceView: React.FC<SystemGovernanceViewProps> = ({
  activeRole,
  onDataReset,
}) => {
  const perms = getRolePermissions(activeRole);
  const [storageHealth, setStorageHealth] = useState<StorageHealthInfo | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; notice: string } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    surveyRepository.getStorageHealth().then(setStorageHealth);
    fetch('/api/ai/status')
      .then(async (r) => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Static hosting');
        }
        return r.json();
      })
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          available: false,
          notice:
            'AI Assistant ไม่พร้อมใช้งานบน Static Hosting (เช่น GitHub Pages) หรือในโหมด Offline — ระบบสำรวจและรายงานหลักทำงานได้ครบถ้วน',
        })
      );
  }, []);

  const handleExportJson = async () => {
    const json = await surveyRepository.exportAllJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xolaraiz-survey-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetDemo = async () => {
    await surveyRepository.resetDemoData();
    setResetConfirm(false);
    onDataReset();
  };

  const usedMb = storageHealth ? (storageHealth.usedBytes / (1024 * 1024)).toFixed(2) : '0.00';
  const quotaMb = storageHealth ? (storageHealth.quotaBytes / (1024 * 1024)).toFixed(0) : '50';

  return (
    <div className="space-y-6">
      {/* Demo Mode & Production Security Notice */}
      <section className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-6 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>สถานะระบบปัจจุบัน: Demo Mode (Local IndexedDB Persistence)</span>
        </div>
        <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
          แอปพลิเคชันนี้ใช้ Repository Interface (`ISurveyRepository`) ที่เชื่อมต่อกับ IndexedDB บนเบราว์เซอร์เพื่อรองรับงานภาคสนามแบบ Offline และแสดงผลการแยกสิทธิ์ตาม Franchise / Role ในระดับแอป
          — ระบบนี้ยังไม่ใช่ระบบ Authentication หรือ Server-side Security Rules สำหรับ Production จริง (ห้ามนำข้อมูลลูกค้าจริงที่ไม่มีฐาน PDPA มาเก็บถาวรบนอุปกรณ์ที่ใช้ร่วมกัน)
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDPA & Data Governance */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Lock className="w-4 h-4 text-slate-600 dark:text-amber-400" />
            <h2>PDPA Privacy Notice และการจัดการข้อมูลส่วนบุคคล</h2>
          </div>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>
              <strong>ข้อมูลอ่อนไหวที่จัดเก็บ:</strong> บิลค่าไฟ ที่อยู่ พิกัด GPS (เมื่อได้รับอนุญาต) เบอร์ติดต่อ ภาพอาคาร และแผนผังระบบไฟฟ้า
            </li>
            <li>
              <strong>การลดข้อมูลเท่าที่จำเป็น:</strong> แบบฟอร์มขอเฉพาะข้อมูลที่จำเป็นต่อการประเมินความปลอดภัยและการออกแบบเบื้องต้น
            </li>
            <li>
              <strong>คำเตือนอุปกรณ์ใช้ร่วมกัน:</strong> ข้อมูล Draft และภาพถ่ายถูกแคชไว้ใน IndexedDB ของเบราว์เซอร์ กรุณาส่งออกและล้างข้อมูลเมื่อใช้อุปกรณ์ส่วนกลาง
            </li>
            <li>
              <strong>การส่งข้อมูลเข้า AI ภายนอก:</strong> ระบบจะไม่ส่งชื่อ-เบอร์โทร-ที่อยู่ลูกค้าเข้า AI โดยอัตโนมัติ (ส่งเฉพาะบริบททางเทคนิคที่ผ่านการตัดข้อมูลระบุตัวตนเมื่อผู้ใช้กดสั่ง)
            </li>
          </ul>

          <div className="pt-2 flex flex-wrap gap-3">
            {perms.canExportOrDeleteData ? (
              <>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออกข้อมูลทั้งหมด (JSON)
                </button>
                {!resetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setResetConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[40px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    รีเซ็ตข้อมูลสาธิตกลับค่าเริ่มต้น
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetDemo}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white"
                    >
                      ยืนยันรีเซ็ตข้อมูลในเครื่อง
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(false)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">
                บทบาทปัจจุบัน ({activeRole}) ไม่มีสิทธิ์ส่งออกหรือล้างฐานข้อมูล (ต้องเป็น Master/Franchise Admin หรือ QA Manager)
              </p>
            )}
          </div>
        </section>

        {/* Storage & AI Status */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Database className="w-4 h-4 text-slate-600 dark:text-amber-400" />
            <h2>พื้นที่เก็บข้อมูล Offline (IndexedDB) และสถานะ AI Server</h2>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              <span>พื้นที่ใช้ไปในอุปกรณ์นี้ (รวมภาพหลักฐาน)</span>
              <span>{usedMb} MB / {quotaMb} MB ({storageHealth?.usedPct ?? 0}%)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  storageHealth?.nearLimit ? 'bg-red-600' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, storageHealth?.usedPct ?? 4))}%` }}
              />
            </div>
            {storageHealth?.nearLimit && (
              <p className="text-xs text-red-600 dark:text-red-400">
                คำเตือน: พื้นที่ Offline ใกล้เต็ม กรุณา Sync หรือส่งออกไฟล์ภาพขนาดใหญ่
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              สถานะ AI Assistant ภายในแอป (Server-side Proxy)
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {aiStatus ? aiStatus.notice : 'กำลังตรวจสอบสถานะ API...'}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Production Readiness Checklist (สิ่งที่ต้องเชื่อมต่อเพิ่มก่อนใช้งานจริง)
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-5">
              <li>เปลี่ยน `surveyRepository` จาก IndexedDB Demo Adapter เป็น Firebase Firestore / Supabase PostgreSQL + Storage</li>
              <li>เปิดใช้ Authentication จริง (JWT / Firebase Auth) และ Server-side Tenant Rules แยก `franchiseId`</li>
              <li>ย้ายการอัปโหลดภาพถ่ายหลักฐานไปยัง Private Object Storage พร้อม Signed URL หมดอายุ</li>
              <li>เชื่อมต่อ Bill OCR Service หรือปรับตั้ง PDF Engine ฝั่งเซิร์ฟเวอร์หากต้องการเอกสารลงนามอิเล็กทรอนิกส์</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
