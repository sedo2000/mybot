import express from "express";
import { Telegraf } from "telegraf";
import { readFileSync, writeFileSync, existsSync } from "fs";

// قراءة التوكن من متغيرات البيئة
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN غير محدد في متغيرات البيئة.");

// إعداد البوت
const bot = new Telegraf(BOT_TOKEN);

// إعداد قاعدة البيانات البسيطة
const DB_FILE = "./db.json";
let db = { users: {}, settings: { welcomeMessage: "", blockedMedia: [], receiveMessage: "" } };
if (existsSync(DB_FILE)) {
  db = JSON.parse(readFileSync(DB_FILE));
}
const saveDB = () => writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ======== أوامر البوت ========

// /start
bot.start((ctx) => {
  const welcome = db.settings.welcomeMessage || "أهلاً بك في البوت!";
  ctx.reply(welcome);
});

// /تعيين_رسالة_ترحيب
bot.command("تعيين_رسالة_ترحيب", (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("أرسل نص رسالة الترحيب بعد الأمر.");
  db.settings.welcomeMessage = text;
  saveDB();
  ctx.reply("تم تعيين رسالة الترحيب بنجاح!");
});

// /حذف_رسالة_ترحيب
bot.command("حذف_رسالة_ترحيب", (ctx) => {
  db.settings.welcomeMessage = "";
  saveDB();
  ctx.reply("تم حذف رسالة الترحيب.");
});

// /قائمة_الأوامر
bot.command("قائمة_الأوامر", (ctx) => {
  const commands = `/start - بدء البوت
/تعيين_رسالة_ترحيب [نص] - تعيين رسالة الترحيب
/حذف_رسالة_ترحيب - حذف رسالة الترحيب
/حظر [user_id] - حظر مستخدم
/إلغاء_حظر [user_id] - إلغاء حظر مستخدم
/معلومات [user_id] - معلومات المستخدم
/تفعيل - تفعيل البوت
/مسح [message_id] - حذف رسالة
/توجيه - إعادة توجيه منشور
/السماح [user_id] - السماح بالتحدث
/تعيين_رسالة_استلام [نص] - رسالة تلقائية عند استقبال محتوى
/قائمة_الوسائط_المحظورة - عرض الوسائط المحظورة`;
  ctx.reply(commands);
});

// /حظر
bot.command("حظر", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!userId) return ctx.reply("يرجى كتابة ID المستخدم للحظر.");
  db.users[userId] = { ...db.users[userId], blocked: true };
  saveDB();
  ctx.reply(`تم حظر المستخدم ${userId}`);
});

// /إلغاء_حظر
bot.command("إلغاء_حظر", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!userId) return ctx.reply("يرجى كتابة ID المستخدم لإلغاء الحظر.");
  db.users[userId] = { ...db.users[userId], blocked: false };
  saveDB();
  ctx.reply(`تم إلغاء الحظر عن المستخدم ${userId}`);
});

// /معلومات
bot.command("معلومات", (ctx) => {
  const userId = ctx.message.text.split(" ")[1] || ctx.from.id;
  ctx.reply(JSON.stringify(ctx.from, null, 2));
});

// /مسح
bot.command("مسح", async (ctx) => {
  const messageId = ctx.message.text.split(" ")[1];
  if (!messageId) return ctx.reply("يرجى كتابة رقم الرسالة للحذف.");
  try {
    await ctx.deleteMessage(messageId);
    ctx.reply("تم حذف الرسالة بنجاح!");
  } catch {
    ctx.reply("تعذر حذف الرسالة.");
  }
});

// /توجيه
bot.command("توجيه", (ctx) => {
  ctx.reply("أرسل المنشور الذي تريد توجيهه الآن...");
});

// /السماح
bot.command("السماح", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!userId) return ctx.reply("يرجى كتابة ID المستخدم.");
  db.users[userId] = { ...db.users[userId], blocked: false };
  saveDB();
  ctx.reply(`تم السماح للمستخدم ${userId} بالتحدث.`);
});

// /تعيين_رسالة_استلام
bot.command("تعيين_رسالة_استلام", (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("أرسل نص رسالة الاستلام بعد الأمر.");
  db.settings.receiveMessage = text;
  saveDB();
  ctx.reply("تم تعيين رسالة الاستلام بنجاح!");
});

// /قائمة_الوسائط_المحظورة
bot.command("قائمة_الوسائط_المحظورة", (ctx) => {
  const list = db.settings.blockedMedia.length ? db.settings.blockedMedia.join(", ") : "لا توجد وسائط محظورة";
  ctx.reply(`الوسائط المحظورة: ${list}`);
});

// استقبال أي رسالة
bot.on("message", (ctx) => {
  const userId = ctx.from.id.toString();
  if (db.users[userId]?.blocked) return;
  if (db.settings.receiveMessage) ctx.reply(db.settings.receiveMessage);
  const messageType = Object.keys(ctx.message).find(k =>
    ["photo","video","voice","document","sticker"].includes(k)
  );
  if (messageType && db.settings.blockedMedia.includes(messageType)) {
    ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    ctx.reply(`تم حظر هذا النوع من الوسائط: ${messageType}`);
  }
});

// ======== إعداد Express + Webhook ========

const app = express();
app.use(express.json());

// Webhook endpoint للبوت
app.use(bot.webhookCallback("/api/bot"));

// صفحة رئيسية للتأكد أن السيرفر شغال
app.get("/", (req,res) => res.send("بوت تلجرام يعمل!"));

// الاستماع على المنفذ الذي يعطيه Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// تفعيل Webhook مع Telegram (استبدل YOUR_VERCEL_URL بالرابط الحقيقي بعد النشر)
bot.telegram.setWebhook(`https://mybot-liart-alpha.vercel.app/api/bot`);
