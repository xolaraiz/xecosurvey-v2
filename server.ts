import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'xolaraiz-solar-site-survey-pro',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

app.get('/api/ai/status', (_req, res) => {
  const configured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  res.json({
    available: configured,
    model: configured ? 'gemini-4-hydrogen' : null,
    notice: configured
      ? 'AI Field Assistant พร้อมใช้งาน (ใช้เฉพาะข้อมูลที่ผ่านการคัดกรองและต้องมีผู้ตรวจทานยืนยัน)'
      : 'AI Assistant ไม่พร้อมใช้งานเนื่องจากยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ',
  });
});

app.post('/api/ai/assist', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(503).json({
      available: false,
      error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงไม่สามารถเรียกใช้ AI Assistant ได้',
    });
    return;
  }

  const { mode, sanitizedContext, approvedStandards } = req.body ?? {};
  if (!mode || !sanitizedContext) {
    res.status(400).json({ error: 'กรุณาระบุ mode และ sanitizedContext' });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `คุณคือผู้ช่วยวิศวกรสำรวจระบบโซลาร์เซลล์ (XOLARAIZ™ Survey Assistant) สำหรับประเทศไทย
กฎบังคับเด็ดขาด:
1. ห้ามอนุมัติความปลอดภัย ห้ามรับรองแบบ หรือสรุปว่าโครงการ "ผ่านมาตรฐาน"
2. ห้ามเดาค่าที่ไม่ได้วัดหน้างาน หรือแต่งเลขข้อ/ปีมาตรฐานขึ้นมาเอง
3. ใช้อ้างอิงเฉพาะรายการมาตรฐานที่ผู้ใช้ส่งให้ในรายการ approvedStandards เท่านั้น ถ้าไม่มีให้ระบุว่า "ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ"
4. แยกให้ชัดระหว่าง "ข้อเท็จจริงหน้างานจากบันทึก" กับ "ข้อเสนอแนะเบื้องต้นจาก AI ที่รอผู้รับผิดชอบตรวจสอบ"
5. ตอบเป็นภาษาไทยที่กระชับ เป็นมืออาชีพ และเข้าใจง่าย`;

    const promptMap: Record<string, string> = {
      summarize: `สรุปบันทึกการสำรวจหน้างานต่อไปนี้ แยกเป็น 1) ข้อเท็จจริงที่บันทึกแล้ว 2) ข้อมูลที่ยังไม่ทราบหรือยังไม่ได้ตรวจ 3) จุดที่ควรเน้นต่อทีมวิศวกรรม:\n\n${JSON.stringify(sanitizedContext, null, 2)}`,
      missing_info: `วิเคราะห์รายการข้อมูลที่ยังตกหล่นหรือเป็น "ไม่ทราบ/ไม่ได้ตรวจ" จากข้อมูลสำรวจต่อไปนี้ และเสนอคำถามเฉพาะเจาะจงสำหรับขอข้อมูลเพิ่มเติมจากลูกค้าหรือเจ้าของอาคาร:\n\n${JSON.stringify(sanitizedContext, null, 2)}`,
      draft_report: `ร่างข้อความ Executive Summary เบื้องต้นสำหรับรายงานการสำรวจ (ต้องระบุว่าเป็นฉบับร่างจาก AI ที่ยังไม่ผ่านการตรวจทานจากวิศวกร และไม่กล่าวอ้างผลประหยัดเกินจริง):\n\n${JSON.stringify(sanitizedContext, null, 2)}`,
      search_standards: `ช่วยจับคู่ประเด็นหน้างานกับรายการมาตรฐานที่ผู้ดูแลอนุมัติแล้วด้านล่าง (ห้ามอ้างอิงนอกเหนือจากรายการนี้):\nมาตรฐานที่อนุมัติ: ${JSON.stringify(approvedStandards ?? [], null, 2)}\nบริบทหน้างาน: ${JSON.stringify(sanitizedContext, null, 2)}`,
    };

    const contents = promptMap[String(mode)] || promptMap.summarize;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction,
      },
    });

    res.json({
      available: true,
      mode,
      disclaimer: 'ข้อความร่างโดย AI เพื่อช่วยสรุปเบื้องต้น ไม่ใช่การรับรองทางวิศวกรรมหรือความปลอดภัย ต้องผ่านการตรวจสอบโดยผู้มีอำนาจรับผิดชอบก่อนนำไปใช้',
      output: response.text ?? '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเรียกใช้ Gemini API';
    res.status(502).json({
      available: true,
      error: message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`XOLARAIZ Solar Site Survey Pro listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
