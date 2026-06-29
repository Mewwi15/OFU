/**
 * อู้ฟู่ mock catalog (Thai grocery / convenience store).
 *
 * The `Product` shape here is the single source of truth that screens, stores,
 * and product components all consume. Images are remote `picsum.photos`
 * placeholders keyed by a unique seed so each product renders distinct art.
 */

export type ProductCategory =
  | 'ของสด'
  | 'เครื่องดื่ม'
  | 'ของแห้ง'
  | 'ของใช้ในบ้าน'
  | 'ขนม'
  | 'ยา';

export type Product = {
  id: string;
  /** Display name, e.g. "ข้าวหอมมะลิ". */
  name: string;
  /** Short tagline, e.g. "หอม นุ่ม คัดพิเศษ". */
  subtitle: string;
  /** 1-2 sentence longer description (for the details page "Read More"). */
  description: string;
  /** Price in Baht, e.g. 165. */
  price: number;
  /** Rating from 0..5. */
  rating: number;
  /** Remote image URIs (first is the primary/grid image). */
  images: string[];
  /** Hex color swatches. */
  colors: string[];
  /** Available sizes. */
  sizes: string[];
  category: ProductCategory;
};

/** Category filter list for the chip rows. 'ทั้งหมด' is the All filter. */
export const categories = [
  'ทั้งหมด',
  'ของสด',
  'เครื่องดื่ม',
  'ของแห้ง',
  'ของใช้ในบ้าน',
  'ขนม',
  'ยา',
] as const;

export type Category = (typeof categories)[number];

/** Build a deterministic picsum placeholder URI for a given seed. */
function img(seed: string): string {
  return `https://picsum.photos/seed/${seed}/600/800`;
}

export const products: Product[] = [
  {
    id: '1',
    name: 'ข้าวหอมมะลิ',
    subtitle: 'หอม นุ่ม คัดพิเศษ',
    description:
      'ข้าวหอมมะลิแท้คัดพิเศษเมล็ดสวย หุงขึ้นหม้อ หอมนุ่มอร่อยทุกคำ เหมาะกับทุกมื้อของครอบครัว',
    price: 165,
    rating: 4.8,
    images: [img('oofoo1')],
    colors: [],
    sizes: ['1 กก.', '5 กก.'],
    category: 'ของแห้ง',
  },
  {
    id: '2',
    name: 'ไข่ไก่สด (แผง 30 ฟอง)',
    subtitle: 'สดใหม่ทุกวัน',
    description:
      'ไข่ไก่สดคัดคุณภาพ แผงละ 30 ฟอง เก็บจากฟาร์มส่งตรงทุกวัน สดใหม่พร้อมปรุงได้สารพัดเมนู',
    price: 125,
    rating: 4.7,
    images: [img('oofoo2')],
    colors: [],
    sizes: [],
    category: 'ของสด',
  },
  {
    id: '3',
    name: 'นมจืด UHT 1 ลิตร',
    subtitle: 'หอมมัน ดื่มง่าย',
    description:
      'นมโคแท้รสจืด UHT ขนาด 1 ลิตร หอมมันกลมกล่อม ดื่มง่าย อุดมด้วยแคลเซียมเหมาะกับทุกวัย',
    price: 55,
    rating: 4.6,
    images: [img('oofoo3')],
    colors: [],
    sizes: [],
    category: 'เครื่องดื่ม',
  },
  {
    id: '4',
    name: 'บะหมี่กึ่งสำเร็จรูป (แพ็ค 6)',
    subtitle: 'อิ่มอร่อย สะดวก',
    description:
      'บะหมี่กึ่งสำเร็จรูปแพ็ค 6 ซอง เส้นเหนียวนุ่ม รสชาติเข้มข้น ปรุงง่ายอิ่มเร็วทันใจทุกเวลา',
    price: 42,
    rating: 4.5,
    images: [img('oofoo4')],
    colors: [],
    sizes: [],
    category: 'ของแห้ง',
  },
  {
    id: '5',
    name: 'น้ำดื่ม',
    subtitle: 'สะอาด สดชื่น',
    description:
      'น้ำดื่มสะอาดผ่านระบบกรองมาตรฐาน รสชาติสดชื่น ดื่มได้อย่างมั่นใจตลอดทั้งวัน',
    price: 14,
    rating: 4.9,
    images: [img('oofoo5')],
    colors: [],
    sizes: ['600 มล.', '1.5 ลิตร'],
    category: 'เครื่องดื่ม',
  },
  {
    id: '6',
    name: 'น้ำมันพืช 1 ลิตร',
    subtitle: 'ทอดกรอบ ไม่อมน้ำมัน',
    description:
      'น้ำมันพืชคุณภาพ ขนาด 1 ลิตร ทอดอาหารได้กรอบอร่อย ไม่อมน้ำมัน เหมาะกับทุกเมนูในครัว',
    price: 58,
    rating: 4.4,
    images: [img('oofoo6')],
    colors: [],
    sizes: [],
    category: 'ของแห้ง',
  },
  {
    id: '7',
    name: 'ผงซักฟอก 800 ก.',
    subtitle: 'ขจัดคราบ หอมสะอาด',
    description:
      'ผงซักฟอกสูตรเข้มข้น ขนาด 800 กรัม ขจัดคราบฝังลึกได้หมดจด ทิ้งกลิ่นหอมสะอาดยาวนาน',
    price: 69,
    rating: 4.3,
    images: [img('oofoo7')],
    colors: [],
    sizes: [],
    category: 'ของใช้ในบ้าน',
  },
  {
    id: '8',
    name: 'มันฝรั่งทอดกรอบ',
    subtitle: 'กรอบ อร่อย เพลิน',
    description:
      'มันฝรั่งทอดกรอบแผ่นบาง ปรุงรสกลมกล่อม กรอบอร่อยเพลินทุกคำ เหมาะเป็นของว่างทุกโอกาส',
    price: 25,
    rating: 4.6,
    images: [img('oofoo8')],
    colors: [],
    sizes: [],
    category: 'ขนม',
  },
  {
    id: '9',
    name: 'พาราเซตามอล 500 มก. (แผง 10 เม็ด)',
    subtitle: 'บรรเทาปวด ลดไข้',
    description:
      'ยาพาราเซตามอล 500 มิลลิกรัม แผงละ 10 เม็ด บรรเทาอาการปวดศีรษะ ปวดเมื่อย และลดไข้ ใช้ได้ทั้งครอบครัว',
    price: 12,
    rating: 4.8,
    images: [img('oofoo9')],
    colors: [],
    sizes: ['แผง 10 เม็ด', 'กล่อง 100 เม็ด'],
    category: 'ยา',
  },
  {
    id: '10',
    name: 'ยาแก้แพ้ ลดน้ำมูก (10 เม็ด)',
    subtitle: 'บรรเทาภูมิแพ้',
    description:
      'ยาบรรเทาอาการแพ้ คัดจมูก น้ำมูกไหล จากภูมิแพ้อากาศ แผงละ 10 เม็ด ออกฤทธิ์เร็ว ทานง่าย',
    price: 28,
    rating: 4.6,
    images: [img('oofoo10')],
    colors: [],
    sizes: [],
    category: 'ยา',
  },
  {
    id: '11',
    name: 'พลาสเตอร์ยา (กล่อง 20 ชิ้น)',
    subtitle: 'ปิดแผล กันน้ำ',
    description:
      'พลาสเตอร์ปิดแผลกันน้ำ กล่องละ 20 ชิ้น เนื้อนุ่มยืดหยุ่น ติดแน่นไม่หลุดง่าย ปกป้องแผลให้สะอาด',
    price: 35,
    rating: 4.7,
    images: [img('oofoo11')],
    colors: [],
    sizes: [],
    category: 'ยา',
  },
];

/** Look up a single product by id. Returns `undefined` when not found. */
export function getProduct(id: string | undefined): Product | undefined {
  if (!id) return undefined;
  return products.find((p) => p.id === id);
}
