# XOLARAIZ™ Solar Site Survey Pro

เครื่องมือสำรวจหน้างาน เก็บหลักฐาน ประเมินความเสี่ยง **CriXisZafe™** และจัดทำรายงานวิศวกรรมโซลาร์เซลล์สำหรับเครือข่าย **XOLARAIZ™ Master Franchise** (ครอบคลุม Residential และ Commercial & Industrial / C&I ในประเทศไทย)

> **ข้อจำกัดความรับผิดชอบทางวิศวกรรม:** แอปพลิเคชันนี้เป็นเครื่องมือช่วยสำรวจและตรวจสอบข้อมูลก่อนการออกแบบ **ไม่ใช่** ระบบรับรองการออกแบบวิศวกรรมหรือรับรองความปลอดภัยโดยอัตโนมัติ

## วิธีติดตั้งและรันโปรเจกต์

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
2. ตั้งค่า Environment Variables (ดูตัวอย่างจาก `.env.example`):
   - `GEMINI_API_KEY` *(ไม่บังคับ)*: หากต้องการเปิดใช้ผู้ช่วยร่างสรุปด้วย AI ฝั่งเซิร์ฟเวอร์ (`/api/ai/assist`) หากไม่ตั้งค่า ระบบจะซ่อน/แจ้งว่าไม่พร้อมใช้งานโดยไม่จำลองคำตอบปลอม
   - `PORT` *(ค่าเริ่มต้น `3000`)*
3. รันโหมดพัฒนา (Express + Vite Middleware):
   ```bash
   npm run dev
   ```
4. ตรวจสอบ TypeScript และ Build สำหรับ Production:
   ```bash
   npm run lint
   npm run build
   npm start
   ```

## โครงสร้างสถาปัตยกรรม (Architecture)

- `server.ts`: Express server บนพอร์ต 3000 พร้อม Vite middleware และ Server-side proxy `/api/ai/assist`
- `src/types/survey.ts`: โมเดลข้อมูลหลัก (`Organization`, `Franchise`, `SolarSurveyProject`, `RoofZone`, `ElectricalConnectionData`, `HazardItem`, `EvidenceFile`, `StandardReference`, `EngineeringReviewRecord`, `SurveyRevision`, `AuditEvent`)
- `src/lib/calculations.ts`: สูตรคำนวณ DC kWp, Specific Yield, Loss Cascade แบบไม่หักซ้ำ, Self-consumption/Export/Curtailment, Low/Base/High Scenario และตัวอ่าน CSV Load Profile
- `src/lib/safety.ts`: กลไก Critical Risk Blocking, Risk Matrix (`Severity × Likelihood`) และตัววิเคราะห์ข้อมูลที่ยังขาด/ไม่ทราบ
- `src/lib/rbac.ts`: สิทธิ์ตามบทบาท (7 บทบาท) และตัวกรองแยกข้อมูลตาม Franchise (`filterProjectsForContext`)
- `src/lib/repository.ts`: `ISurveyRepository` Adapter (ปัจจุบันใช้ `IndexedDBSurveyRepository` สำหรับ Demo Mode & Offline Drafts)

## สถานะฟีเจอร์ (Working vs Demo/Mock vs Production Next Steps)

- **ทำงานจริงในฝั่ง Client + IndexedDB:**
  - การสร้างโครงการ Residential / C&I, Autosave ลง IndexedDB แบบ Offline, การวิเคราะห์ความครบถ้วนและสถานะ Epistemic (`ทราบค่า` / `ไม่ทราบ` / `ไม่ได้ตรวจ` / `ไม่ปลอดภัยที่จะตรวจ` / `ต้องใช้ผู้มีคุณสมบัติ`)
  - Safety Gate & Risk Register พร้อมล็อกการข้าม Critical Risk
  - การอัปโหลดรูปภาพ/PDF, Canvas Markup (แยกต้นฉบับจากเลเยอร์แก้ไข), CSV Load Profile Parser
  - เครื่องคำนวณ Low/Base/High Scenario และรายงาน 2 รูปแบบพร้อม Print/Save as PDF ภาษาไทย
  - การสร้าง Revision ใหม่เมื่อแก้ไขข้อมูลเทคนิคหลังตรวจทาน
- **อยู่ในโหมดสาธิต (Demo Mode):**
  - ข้อมูลตั้งต้น 2 โครงการ (บ้านพักอาศัย + โรงงาน/คลังสินค้า) เป็นข้อมูลสมมติ
  - การสลับ Role และ Franchise เป็นตัวจำลองบน Client เพื่อทดสอบ UX และกฎการมองเห็น
- **สิ่งที่ต้องเชื่อมต่อเพิ่มก่อนใช้งาน Production:**
  - เปลี่ยน `ISurveyRepository` เป็น Firebase Firestore หรือ Supabase PostgreSQL พร้อม Server-side Security Rules แยก `franchiseId`
  - ระบบ Authentication จริงและการจัดการ Private Object Storage สำหรับภาพถ่าย/เอกสารลูกค้าตาม PDPA
