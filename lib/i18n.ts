/**
 * Lightweight i18n. `useT()` returns a `t(key)` bound to the current language
 * (re-renders on change). Missing keys fall back to Thai, then the key itself.
 * Strings are added screen-by-screen — start with the account cluster.
 */

import { useLocale, type Lang } from '@/store/locale';

type Dict = Record<string, string>;

const th: Dict = {
  'common.cancel': 'ยกเลิก',
  'common.tryAgain': 'กรุณาลองใหม่อีกครั้ง',
  'common.notSet': 'ยังไม่ได้เพิ่ม',

  'account.title': 'บัญชีของฉัน',
  'account.notifications': 'การแจ้งเตือน',
  'account.editProfile': 'แก้ไขโปรไฟล์',
  'account.memberId': 'รหัสสมาชิก',
  'account.phoneLabel': 'เบอร์มือถือ',
  'account.loginAccountLabel': 'บัญชีที่ใช้เข้าสู่ระบบ',
  'account.loginPhone': 'เบอร์โทร',
  'account.menu.orders': 'คำสั่งซื้อของฉัน',
  'account.menu.ordersCap': 'ดูออเดอร์ที่ผ่านมาและกำลังดำเนินการ',
  'account.menu.address': 'ที่อยู่จัดส่ง',
  'account.menu.addressCap': 'จัดการที่อยู่สำหรับจัดส่งสินค้า',
  'account.menu.notif': 'ตั้งค่าการแจ้งเตือน',
  'account.menu.notifCap': 'ข่าวสารและโปรโมชัน',
  'account.menu.lang': 'เปลี่ยนภาษา',
  'account.menu.langCap': 'ภาษาไทย / English',
  'account.menu.legal': 'ข้อมูลทางกฎหมาย',
  'account.menu.legalCap': 'ข้อกำหนดและนโยบายความเป็นส่วนตัว',
  'account.menu.help': 'ศูนย์ช่วยเหลือ',
  'account.menu.helpCap': 'ติดต่อเราหรือคำถามที่พบบ่อย',
  'account.logout': 'ออกจากระบบ',
  'account.logoutConfirm': 'ต้องการออกจากระบบใช่ไหม?',
  'account.delete': 'ลบบัญชี',
  'account.deleteBody':
    'ข้อมูลส่วนตัวของคุณจะถูกลบถาวรและออกจากระบบทันที (ประวัติคำสั่งซื้อจะถูกเก็บแบบไม่ระบุตัวตนตามกฎหมาย) — ดำเนินการต่อหรือไม่?',
  'account.deleteFailed': 'ลบบัญชีไม่สำเร็จ',
  'account.helpBody': 'ติดต่อทีมงานอู้ฟู่ได้ที่ 02-000-0000 ทุกวัน 8:00-22:00 น.',

  'common.back': 'ย้อนกลับ',
  'common.and': 'และ',
  'login.welcome': 'ยินดีต้อนรับสู่ อู้ฟู่',
  'login.tagline': 'ของสดของดี ส่งถึงบ้าน',
  'login.phoneLabel': 'เบอร์โทรศัพท์',
  'login.requestOtp': 'ขอรหัส OTP',
  'login.sending': 'กำลังส่ง…',
  'login.orSignInWith': 'หรือเข้าสู่ระบบด้วย',
  'login.continueGoogle': 'ดำเนินการต่อด้วย Google',
  'login.changePhone': 'เปลี่ยนเบอร์',
  'login.enterOtp': 'กรอกรหัส OTP',
  'login.otpSentTo': 'ส่งรหัส 6 หลักไปที่ ',
  'login.verify': 'ยืนยัน',
  'login.verifyCode': 'ยืนยันรหัส',
  'login.verifying': 'กำลังตรวจสอบ…',
  'login.resend': 'ขอรหัสใหม่อีกครั้ง',
  'login.resendA11y': 'ขอรหัสใหม่',
  'login.consentPrefix': 'การเข้าสู่ระบบถือว่าคุณยอมรับ',
  'login.terms': 'ข้อกำหนดการใช้งาน',
  'login.privacy': 'นโยบายความเป็นส่วนตัว',
  'login.otpSendFailed': 'ส่งรหัส OTP ไม่สำเร็จ ลองใหม่อีกครั้ง',
  'login.otpInvalid': 'รหัส OTP ไม่ถูกต้อง',
  'login.socialFailed': 'เข้าสู่ระบบไม่สำเร็จ',
  'login.socialFailedBody': 'ไม่สามารถเข้าสู่ระบบด้วยโซเชียลได้ กรุณาลองใหม่',

  'settings.title': 'ตั้งค่าการแจ้งเตือน',
  'settings.promoLabel': 'ข่าวสารและโปรโมชัน',
  'settings.promoCap': 'รับแจ้งเตือนดีล ส่วนลด และข่าวสารจากร้าน',
  'settings.note': 'การแจ้งเตือนสถานะคำสั่งซื้อจะส่งให้เสมอ เพื่อให้คุณติดตามออเดอร์ได้ตลอด',
  'settings.saveFailed': 'บันทึกไม่สำเร็จ',

  'language.title': 'เปลี่ยนภาษา',
  'language.thai': 'ภาษาไทย',
  'language.english': 'English',

  'legal.title': 'ข้อมูลทางกฎหมาย',
  'legal.note': 'อัปเดตล่าสุด: เวอร์ชันทดลอง — ข้อความฉบับสมบูรณ์จะประกาศก่อนเปิดให้บริการจริง',
  'legal.s1.title': 'ข้อกำหนดการใช้งาน',
  'legal.s1.body':
    'การใช้แอปอู้ฟู่ถือว่าคุณยอมรับข้อกำหนดการใช้งาน คุณตกลงจะใช้บริการตามกฎหมาย ไม่ใช้ในทางที่ผิด และรับผิดชอบข้อมูลในบัญชีของคุณ ราคาสินค้าและค่าจัดส่งเป็นไปตามที่แสดงขณะสั่งซื้อ',
  'legal.s2.title': 'นโยบายความเป็นส่วนตัว (PDPA)',
  'legal.s2.body':
    'เราเก็บข้อมูลส่วนบุคคล (ชื่อ เบอร์โทร ที่อยู่จัดส่ง) เพื่อให้บริการจัดส่งและติดต่อเรื่องคำสั่งซื้อเท่านั้น เราไม่ขายข้อมูลของคุณ คุณมีสิทธิ์ขอเข้าถึง แก้ไข หรือลบข้อมูล และถอนความยินยอมได้ทุกเมื่อผ่านเมนู "ลบบัญชี"',
  'legal.s3.title': 'การชำระเงินและการคืนเงิน',
  'legal.s3.body':
    'รองรับการชำระเงินปลายทางและพร้อมเพย์ (แนบสลิป) กรณีสินค้ามีปัญหาหรือยกเลิกก่อนจัดส่ง สามารถติดต่อขอคืนเงินได้ตามเงื่อนไขของร้าน',
  'legal.s4.title': 'ติดต่อเรา',
  'legal.s4.body':
    'ร้านอู้ฟู่ · โทร 02-000-0000 ทุกวัน 8:00–22:00 น. สำหรับคำถามเรื่องข้อมูลส่วนบุคคล ติดต่อเจ้าหน้าที่คุ้มครองข้อมูลได้ที่ช่องทางเดียวกัน',
};

const en: Dict = {
  'common.cancel': 'Cancel',
  'common.tryAgain': 'Please try again.',
  'common.notSet': 'Not set',

  'account.title': 'My Account',
  'account.notifications': 'Notifications',
  'account.editProfile': 'Edit profile',
  'account.memberId': 'Member ID',
  'account.phoneLabel': 'Mobile number',
  'account.loginAccountLabel': 'Signed in with',
  'account.loginPhone': 'Phone',
  'account.menu.orders': 'My orders',
  'account.menu.ordersCap': 'View past and ongoing orders',
  'account.menu.address': 'Delivery addresses',
  'account.menu.addressCap': 'Manage your delivery addresses',
  'account.menu.notif': 'Notification settings',
  'account.menu.notifCap': 'News and promotions',
  'account.menu.lang': 'Language',
  'account.menu.langCap': 'ภาษาไทย / English',
  'account.menu.legal': 'Legal',
  'account.menu.legalCap': 'Terms and privacy policy',
  'account.menu.help': 'Help center',
  'account.menu.helpCap': 'Contact us or FAQ',
  'account.logout': 'Sign out',
  'account.logoutConfirm': 'Do you want to sign out?',
  'account.delete': 'Delete account',
  'account.deleteBody':
    'Your personal data will be permanently removed and you will be signed out immediately (order history is kept anonymized as required by law). Continue?',
  'account.deleteFailed': 'Could not delete account',
  'account.helpBody': 'Reach the Oofoo team at 02-000-0000, daily 8:00–22:00.',

  'common.back': 'Back',
  'common.and': 'and',
  'login.welcome': 'Welcome to Oofoo',
  'login.tagline': 'Fresh groceries, delivered home',
  'login.phoneLabel': 'Phone number',
  'login.requestOtp': 'Request OTP',
  'login.sending': 'Sending…',
  'login.orSignInWith': 'Or sign in with',
  'login.continueGoogle': 'Continue with Google',
  'login.changePhone': 'Change number',
  'login.enterOtp': 'Enter OTP',
  'login.otpSentTo': 'A 6-digit code was sent to ',
  'login.verify': 'Confirm',
  'login.verifyCode': 'Confirm code',
  'login.verifying': 'Verifying…',
  'login.resend': 'Resend code',
  'login.resendA11y': 'Resend code',
  'login.consentPrefix': 'By signing in you accept our',
  'login.terms': 'Terms of Use',
  'login.privacy': 'Privacy Policy',
  'login.otpSendFailed': 'Could not send the OTP. Please try again.',
  'login.otpInvalid': 'Incorrect OTP code',
  'login.socialFailed': 'Sign-in failed',
  'login.socialFailedBody': 'Could not sign in with social. Please try again.',

  'settings.title': 'Notification settings',
  'settings.promoLabel': 'News and promotions',
  'settings.promoCap': 'Get alerts on deals, discounts, and shop news',
  'settings.note': 'Order status alerts are always sent so you can track your orders.',
  'settings.saveFailed': 'Could not save',

  'language.title': 'Language',
  'language.thai': 'ภาษาไทย',
  'language.english': 'English',

  'legal.title': 'Legal',
  'legal.note': 'Last updated: preview version — the full text will be published before launch.',
  'legal.s1.title': 'Terms of use',
  'legal.s1.body':
    'By using Oofoo you accept these terms. You agree to use the service lawfully, not misuse it, and stay responsible for your account. Prices and delivery fees are as shown at checkout.',
  'legal.s2.title': 'Privacy policy (PDPA)',
  'legal.s2.body':
    'We collect personal data (name, phone, delivery address) only to deliver your orders and contact you about them. We do not sell your data. You may request access, correction, or deletion, and withdraw consent anytime via "Delete account".',
  'legal.s3.title': 'Payments and refunds',
  'legal.s3.body':
    'We support cash on delivery and PromptPay (with slip). For faulty items or cancellations before dispatch, you may request a refund per the shop’s terms.',
  'legal.s4.title': 'Contact us',
  'legal.s4.body':
    'Oofoo · 02-000-0000, daily 8:00–22:00. For data-privacy questions, contact our data protection officer through the same channel.',
};

const TABLE: Record<Lang, Dict> = { th, en };

export function translate(lang: Lang, key: string): string {
  return TABLE[lang][key] ?? th[key] ?? key;
}

/** Hook: returns `t(key)` bound to the current language. */
export function useT(): (key: string) => string {
  const lang = useLocale((s) => s.lang);
  return (key: string) => translate(lang, key);
}
