# ติดตั้ง Namo Agent World จาก GitHub ไป Cloudflare (มือถือและคอมเป็นเว็บเดียวกัน)

## 0. สิ่งที่ต้องรู้

โปรเจกต์นี้ใช้ **Cloudflare Workers + Static Assets + D1** ใน Worker เดียว ไม่ใช้ Cloudflare Pages แยกอีกตัว เมื่อเผยแพร่แล้วจะได้ลิงก์เดียวแบบ `https://namo-agent-world.<subdomain>.workers.dev` (ชื่อจริงขึ้นอยู่กับบัญชี) เปิดได้จากมือถือและคอม แม้คอมปิดอยู่

Cloudflare Free มีโควตา ไม่รับประกันว่าบริการฟรีไม่จำกัดหรือว่าจะทำงาน AI ตลอด 24 ชั่วโมงโดยไม่มีข้อจำกัด การเชื่อม ChatGPT และ Claude ในเวอร์ชันนี้ยังใช้คัดลอกคำสั่งและนำคำตอบกลับ ไม่ใช่ API อัตโนมัติ

## 1. GitHub ของ Namo พร้อมแล้ว

โปรเจกต์อยู่ที่ [Sans762/Ai-agent-world-](https://github.com/Sans762/Ai-agent-world-) บน branch `main` โดยแยกจากโปรเจกต์ AI เดิมแล้ว หากมีการแก้โค้ด ให้ทำผ่านรีโปนี้เพียงที่เดียว

**โปรดระวัง:** รีโปนี้ถูกตั้งเป็น Public ใน GitHub ณ วันที่ตรวจสอบ จึงห้ามบันทึกรหัสผ่านหรือ API key ลงในไฟล์โค้ดหรือประวัติ Git

## 2. ผูก Cloudflare กับ GitHub

เปิด https://dash.cloudflare.com/ → **Workers & Pages → Create application → GitHub** (บางหน้าจออาจแสดง Connect to Git) → อนุญาตให้ Cloudflare เข้าถึงรีโป Namo → เลือก `Sans762/Ai-agent-world-` → Production branch `main`.

ค่าที่ใช้:
- Project / Worker name: `namo-agent-world` (ตรงกับ `wrangler.toml`)
- Root directory: `/` (root)
- Build command: ว่าง หรือ `npm test` หาก Cloudflare อนุญาตให้ใส่
- Deploy command: `npx wrangler deploy`

เลือก Save and Deploy เพื่อเผยแพร่ทั้งเว็บและ API ที่ URL เดียวกัน เมื่อ Push โค้ดใหม่ Cloudflare จะ Deploy อัตโนมัติจาก GitHub

**หมายเหตุ:** หน้าแผนที่อาจเปิดได้หลัง deploy แรก แต่ระบบงานกลางยังไม่พร้อมจนกว่าจะติดตั้ง D1 และรหัสเจ้าของตามข้อ 3–4

## 3. สร้างฐานข้อมูลกลาง D1

บน Cloudflare → **Storage & databases → D1 SQL database** → Create database → ชื่อ `namo-world-db` → Create

ดู **Database ID (UUID)** ของฐานข้อมูลนี้ จากนั้นเพิ่มค่าจริงในไฟล์ `wrangler.toml` ด้านล่าง และ Commit ไปที่ GitHub:

```toml
[[d1_databases]]
binding = "DB"
database_name = "namo-world-db"
database_id = "<YOUR_ACTUAL_D1_DATABASE_UUID>"
```

ห้ามใช้ค่าตัวอย่างเป็น database_id จริง

ใน Cloudflare D1 SQL console ให้เปิดไฟล์ `migrations/0001_tasks.sql` จาก GitHub แล้วรันคำสั่ง SQL ในไฟล์เพื่อสร้างตาราง `tasks`; หรือใช้ GitHub Codespaces/เครื่องที่มี Node.js เพื่อรัน:

```bash
npm install
npx wrangler login
npx wrangler d1 migrations apply namo-world-db --remote
```

เช็กว่า migration สำเร็จก่อนเริ่มสร้างงาน หากเคยสร้าง D1 แล้วไม่ต้องสร้างซ้ำ

## 4. ตั้งรหัสเข้าใช้ส่วนกลาง

Cloudflare → Worker `namo-agent-world` → **Settings → Variables and Secrets** → เพิ่ม Secret:
- Name: `OWNER_KEY`
- Value: รหัสผ่านที่คุณคิดเองอย่างน้อย 12 ตัวอักษร (แนะนำ 20 ตัวขึ้นไป)

**อย่าใส่รหัสจริงในโค้ดหรือ GitHub**. เปิดเว็บ Namo → Settings → กรอก OWNER_KEY แล้วเลือกเชื่อม Cloud เครื่องอื่นให้ใช้ OWNER_KEY เดียวกัน ระบบจะดึงงานจาก D1 ชุดเดียวกัน

หากต้องการเปิด Gemini เพิ่ม Secret อีกตัวคือ `GEMINI_API_KEY` จาก Google AI Studio โดยคีย์และโควตาเป็นของ Google ไม่ได้หมายความว่า Gemini ใช้ฟรีไม่จำกัด

## 5. วิธีตรวจว่าใช้ได้จริง

- เปิด URL ของ Worker ในมือถือและคอม
- ล็อกอินด้วย OWNER_KEY ในทั้งสองเครื่อง
- สถานะแอปต้องแสดง `SYNC` ไม่ใช่ `LOCAL` หรือ `LOGIN`
- สร้างงานจากมือถือ แล้วรีเฟรชบนคอม งานเดียวกันต้องปรากฏ
- ไปที่ `<URL>/api/health` เพื่อตรวจการตอบกลับเซิร์ฟเวอร์ (ค่า cloudConfigured ควรเป็น true หลังผูก DB)
- Agent เดินตามสถานะในเมืองเป็นภาพแสดงงาน; ไม่ได้หมายความว่ามีโมเดล 6 ตัวประมวลผลพร้อมกัน

## 6. ข้อผิดพลาดที่พบบ่อย

- หน้าเว็บเปิดได้แต่สถานะ `LOGIN` → ยังไม่กรอกรหัส OWNER_KEY บนอุปกรณ์นี้
- สถานะ `LOCAL` → อาจเปิดไฟล์ HTML โดยตรงหรือ API ไม่พร้อม แปลว่าไม่ได้ซิงก์ผ่าน D1
- ขึ้น `d1_database_not_bound` → ขาด binding `DB` ใน `wrangler.toml`
- ขึ้น `no such table: tasks` → ยังไม่ได้รัน migration บนฐานข้อมูล D1 จริง
- Deploy error worker-name mismatch → ให้ชื่อ Worker ใน Dashboard เท่ากับ `name` ใน `wrangler.toml`
- ไม่มีคำตอบ AI → Gemini ยังไม่ตั้ง Secret หรือโควตาหมด; ChatGPT/Claude ใช้ handoff ด้วยคน ไม่ใช่ API อัตโนมัติ

แหล่งเอกสาร: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/ และ https://developers.cloudflare.com/d1/get-started/
