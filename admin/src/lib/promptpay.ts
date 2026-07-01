// PromptPay QR (EMVCo / Thai QR standard) payload generator.
// target = shop PromptPay id: a mobile number (0812345678) or a 13-digit
// national/tax id. amount (baht) makes it a one-time dynamic QR.

const AID = 'A000000677010111';

const tlv = (id: string, value: string) => id + value.length.toString().padStart(2, '0') + value;

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptpayPayload(target: string, amount?: number): string {
  const id = target.replace(/[^0-9]/g, '');
  const proxy =
    id.length >= 13
      ? tlv('02', id) // national / tax id
      : tlv('01', '0066' + id.replace(/^0/, '')); // mobile → 0066 + number w/o leading 0
  const merchant = tlv('29', tlv('00', AID) + proxy);
  const body =
    tlv('00', '01') +
    tlv('01', amount != null ? '12' : '11') +
    merchant +
    tlv('53', '764') + // THB
    (amount != null ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'TH');
  const payload = body + '6304';
  return payload + crc16(payload);
}
