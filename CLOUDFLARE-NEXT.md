# ขั้นตอนต่อไปใน Cloudflare (GitHub เชื่อมอัตโนมัติ)

GitHub: https://github.com/Sans762/Ai-agent-world-

1. เข้า Cloudflare Dashboard → Workers & Pages → Create application → GitHub แล้วอนุญาต Cloudflare เข้าถึงรีโป `Sans762/Ai-agent-world-`
2. เลือก `main`; Worker name ต้องตรงกับ `namo-agent-world` ใน `wrangler.toml`; Root directory `/`; Deploy command `npx wrangler deploy`; ไม่ต้องใส่ Build command เพราะ frontend เป็น HTML/JS ธรรมดา
3. กด Save and Deploy เว็บจะอยู่ที่ Cloudflare-assigned URL `*.workers.dev` ชื่อจริงดูใน Cloudflare Dashboard **อย่าเดา URL**
4. เพื่อเปิดระบบงานแบบซิงก์: สร้าง D1 database ชื่อ `namo-world-db`; นำ UUID จริงไปเพิ่ม `[[d1_databases]]` ใน `wrangler.toml` และ Push การแก้ไขไปยัง `main` หรือใช้ `npx wrangler d1 create namo-world-db --binding DB --update-config` จาก dev environment แล้ว commit ผลลัพธ์
5. ใน Cloudflare D1 รัน `migrations/0001_tasks.sql` เพื่อสร้างตาราง (หรือ `npx wrangler d1 migrations apply namo-world-db --remote`)
6. Cloudflare → Worker → Settings → Variables and Secrets → ตั้ง `OWNER_KEY` เป็นรหัสส่วนตัวสุ่มยาว >= 12 ตัวอักษร ไม่ต้องบอก ChatGPT และห้ามใส่ GitHub
7. ถ้าจะใช้ AI Gemini จริง เพิ่ม secret `GEMINI_API_KEY` ของคุณเอง และใช้โควตาตามผู้ให้บริการ
8. เปิด URL ที่ Cloudflare สร้าง ทั้งมือถือและคอม ล็อกอินด้วย OWNER_KEY อันเดียว ตรวจ `/api/health` แล้วสร้างงานจากเครื่องหนึ่ง ตรวจอีกเครื่องหนึ่ง

ข้อจำกัด: โค้ดเวอร์ชันนี้ ChatGPT/Claude เป็นการส่งต่อแบบแมนนวล ยังไม่ใช่การรวม API ฟรีไว้ในเว็บไซต์ และตัวละครเป็นการแสดงสถานะจากงาน ไม่ใช่ AI 6 โมเดลที่กำลังคิดพร้อมกัน

Reference: https://developers.cloudflare.com/workers/ci-cd/builds/
