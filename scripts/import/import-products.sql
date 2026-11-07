-- OFU: import 436 สินค้าใหม่จาก ofu.xls (draft, ไม่มีรูป) — idempotent by barcode
-- รันใน Supabase → SQL Editor  |  รันซ้ำได้ ไม่ดับเบิล
do $$
declare v_pid uuid; v_vid uuid;
begin
  if not exists (select 1 from product_variants where barcode='0001') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'เกลือป่น120กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,2,49,'0001',1,'ชิ้น') returning id into v_vid;
    if 49>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,49,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0002') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำปั่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,0,'0002',15,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0003') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำโค้กแก้วถัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,87,'0003',15,'ชิ้น') returning id into v_vid;
    if 87>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,87,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0004') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ขนมโบราณ 5 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,44,'0004',4.17,'ชิ้น') returning id into v_vid;
    if 44>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,44,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0005') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'กล้วยตากแพ็ค 35 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,4,'0005',28,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0006') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'หมูกระจก 12 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,1,8,'0006',10,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0007') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ขนมเปี๊ยะปรีชา 10 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,4,'0007',9,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0008') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ข้าวหอมใบเตยตรากุหลาบ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,320,9,'0008',290,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0009') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ข้าวหอมมะลิเพชร101') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,615,10,'0009',585,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0010') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ข้าวหอมคัดพิเศษคุณนุ่ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,270,10,'0010',240,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0011') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำแข็งยูนิต 5 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,0,'0011',3,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0012') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ลูกอม 5 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,0,'0012',3.5,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0013') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'บ๊วยรวมรส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,2,0,'0013',1.6,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0014') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ข้าวใบตอง 15กก') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,270,0,'0014',250,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='0015') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'เทียนขาว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,2,51,'0015',1.82,'ชิ้น') returning id into v_vid;
    if 51>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,51,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='011') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โค้กขวดแก้ว ไม่ใส่น้ำแข็ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,13,0,'011',10,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='1111') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'4866c888-a48d-4441-922e-cc2ef0653c3c'::uuid,'ไข่ไก่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,5,'1111',4.33,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='160711') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ถุงร้อนใส 7*11') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,0,'160711',50,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='18851028002878') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิล UHT 300 มล ยกลัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,390,0,'18851028002878',350,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='200392') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ไม้ขนไก่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,0,'200392',50,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='2222') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'4866c888-a48d-4441-922e-cc2ef0653c3c'::uuid,'ไข่เค็ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,8,16,'2222',6.5,'ชิ้น') returning id into v_vid;
    if 16>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,16,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='3333') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ลวดกำมะหยี่แพ็ค100เส้น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,40,0,'3333',35,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4005808606634') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียร์ โรล์ออน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,0,'4005808606634',82,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4005808837472') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวีย โรลออน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,95,0,'4005808837472',74,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4005808888368') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียร์เมนเอกตร้าไบรท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,119,0,'4005808888368',99,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='42418023') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียซันซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,29,4,'42418023',20.83,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4444') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'พริกไทยเม็ด 5 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'4444',3.5,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4710363637602') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮเตอร์คัลเลอร์ 500มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,50,3,'4710363637602',45,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='48850086141698') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โอวัลติน165 มล ยกลัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,350,0,'48850086141698',305,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4902430412988') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แพนทีนแชมพู สีชมพู 380 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,130,2,'4902430412988',99.5,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4902430884945') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แพนทีนแชมพู สีแดง 380 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,130,2,'4902430884945',116,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4987176166074') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ปรับผ้านุ่ม DOWNY กลิ่นดอกคอตตอน 950 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,139,0,'4987176166074',112,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='4987176219398') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แชมพูเฮดแอนโชซ์เดอร์ 370มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,149,2,'4987176219398',114.5,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='50230112') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'กาวิสคอน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,12,'50230112',25.25,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='5555') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'น้ำปลาตราไส้ตันไขว้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,18,11,'5555',14.58,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64413147') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วาสลีน เฮลธี้ ไบร์ท300มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,119,3,'64413147',104.5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64935375') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แชมพู ซันซิลชมพู 325 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,0,'64935375',65,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64935405') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แชมพู ซันซิลเหลือง 325 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,8,'64935405',65,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64936082') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ครีมนวด ซันซิลส้ม 300 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,6,'64936082',65,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64936086') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ครีมนวด ซันซิลเขียว 300 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,7,'64936086',65,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64936098') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ครีมนวด ซันซิลเหลือง 300 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,6,'64936098',56.67,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='64948950') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วาสลีน เฮลตี้ ไบร์ 470 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,199,1,'64948950',149.5,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='6666') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้าแข็ง 10 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,3,'6666',5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='7777') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ไม้กวาดอ่อน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,5,'7777',65,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8801073110502') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ซัมยัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,51,0,'8801073110502',39,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850002032866') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'3แจ๋ว+แจ่ม3000กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,1,'8850002032866',100,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850002037892') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'เปาซุปเปอร์ซอฟท์750ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,42,2,'8850002037892',33,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850006901182') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'สบู่โพรเทค โปรคลีน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,4,'8850006901182',12.25,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850007040354') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'จอนสันแชมพูแอกทีฟคิดส์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,79,0,'8850007040354',65,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850007040385') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'จอนสันแอกทีฟ คิดส์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,79,0,'8850007040385',69,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850007331674') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ผ้าอนามัยแคร์ฟรีแบบ 20 แผ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,39,6,'8850007331674',33.33,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850007815662') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ลิศเตอลีน คลูมินต์ ซีโร่750มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,179,1,'8850007815662',137,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850024109843') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอนฟาเลก เอพลัส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,489,0,'8850024109843',465,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850024110061') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอนฟาเล็กสูตร 2 ปริมาณ 2850กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,2900,0,'8850024110061',2785,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850029028507') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียกลูต้าไนอะซีนาไมล์สีส้ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,139,3,'8850029028507',107,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850029038094') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'นีเวียบอดี้ไวท์ซุปเปอร์สีเหลือง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,165,2,'8850029038094',126,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850029044347') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียลูมีนัส630แอนตี้สปอร์ต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,6,'8850029044347',36.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850029044354') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'นีเวียลูมีนัส630 สกินโกล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,39,6,'8850029044354',25.33,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850038400011') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซอสหอยนางรมตราแม่ครัว 150มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,3,'8850038400011',24.5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850039204021') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'กระดาษทิชชู สก็อต แพ็ค 6 ม้วน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,129,1,'8850039204021',109,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850046015023') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'กระดาษทิชชูเซลล็อก์ ม้วน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,129,1,'8850046015023',99,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850046100026') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'กระดาษทิชชู ซิลค์ม้วน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,50,1,'8850046100026',39,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850058003346') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'น้ำจิ้ม สุกี้ พันท้าย 330 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,3,'8850058003346',54,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850086141669') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โอวัลตินUHTกล่อง165มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,3,'8850086141669',8.47,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850086161674') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โอวัลติน UHT (แพ็ค 12 กล่อง)') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,120,0,'8850086161674',99,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850086163609') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โอวันติล3in1 (12 ซอง)') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,1,'8850086163609',95,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850086164521') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โอวัลติน3in1 (15ซอง)') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,145,0,'8850086164521',115,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850086165108') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โอวัลติน3in1 (17ซอง)') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,155,1,'8850086165108',122,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850088601406') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ปุ้มปุ๋ยปลารากพริก 155 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,9,'8850088601406',25,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092222512') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยารีดผ้าไฮยีนชมพู 500มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,2,'8850092222512',11.33,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092224516') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยารีดผ้าไฮยีนสีฟ้า 500มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,3,'8850092224516',11.33,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092252458') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาซักผ้าไฮยีน กลิ่นเลิฟลี่บลูม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,12,'8850092252458',39,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092260330') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'Hi giene  ปรับผ้านุ่ม สีขาว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,18,0,'8850092260330',13.67,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092275105') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนซันไรส์คิสแบบแพ็ก20มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,1,'8850092275105',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092275907') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ปรับผ้านุ่นไฮยีน ซันไรส์ คิส 1000มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,17,'8850092275907',93,'ชิ้น') returning id into v_vid;
    if 17>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,17,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092277901') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ปรับผ้านุ่มไฮยีน สปริงแมกโนเลีย 1000 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,2,'8850092277901',96,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092278908') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่ม กลิ่นโอเชี่ยนบลู 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,2,'8850092278908',83.34,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092279738') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนเรนโบว์บูม20มลแบบแพ็ค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,1,'8850092279738',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092280109') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนขาวมิลกี้แบบแพ็ค24ซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,1,'8850092280109',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092281106') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนซองเล็กกลิ่นบลูมมิ่งทัช') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,1,'8850092281106',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092281908') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาปรับผ้านุ่มไฮยีน กลิ่บลูมมิ่ง ทัช 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,6,'8850092281908',93,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092282608') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่ม สวีท คิส 480 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,24,'8850092282608',42.5,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092282851') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่ม กลิ่นสวีท คิส 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,1,'8850092282851',83.34,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092283605') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่มมอนิ่งเฟรช 480 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,24,'8850092283605',42.5,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092287900') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาปรับผ้านุ่มไฮยีน กลิ่นเลิฟทัช 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,8,'8850092287900',93,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092288792') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่ม กลิ่นดรีมมี่ฮัก 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,1,'8850092288792',83.34,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850092294908') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไฮยีนปรับผ้านุ่มกลิ่นซันคิส บลูมมิ่ง 1000 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,2,'8850092294908',83.34,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850100101211') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ไวไวปรุงสำเร็จแบบแพ็ก 10 ห่อ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,70,2,'8850100101211',56,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850100126016') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ไวไว รสหมูสับต้มยำ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,5,'8850100126016',6.1,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850100126207') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ไวไวรสหมูสับต้มยำแบบแพ็ก 10 ห่อ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,70,2,'8850100126207',56,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850122101053') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'วุ้นเส้นตรามังกรคู่ 80 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,10,'8850122101053',12.5,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850122334154') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งมันสำปะหลัง 400กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8850122334154',15,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850122344153') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งข้าวเจ้า 400กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,28,3,'8850122344153',23,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850122354152') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งข้าวเหนียว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,3,'8850122354152',29,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850122394158') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'สาคูรวมมิตร 400กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,3,'8850122394158',21,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124003850') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำเปล่าเพียวไลท์0.6ลิตร') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,29,'8850124003850',4.58,'ชิ้น') returning id into v_vid;
    if 29>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,29,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124012869') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เนสเขียวแบบซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,27,'8850124012869',4.29,'ชิ้น') returning id into v_vid;
    if 27>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,27,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124025258') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เนสกาแฟ ลาเต้ 170 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,11,'8850124025258',13.33,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124034519') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เนสแดงแบบซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,23,'8850124034519',4.29,'ชิ้น') returning id into v_vid;
    if 23>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,23,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124037473') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ครีมเทียมข้นหวาน ขนาด 2 กิโล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,160,0,'8850124037473',125,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124065414') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แม็กกี้ เหยาะจิ้ม 200 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,40,3,'8850124065414',30,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850124070999') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'นมสด คาร์เนชั่น 369 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,4,'8850124070999',26,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850125073364') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เนสกาแฟโกลด์ ริส แอนด์ สมูท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,250,0,'8850125073364',206,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850125090149') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไมโลแอคทิฟโก 3in1') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,145,2,'8850125090149',120,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850127004397') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เนสกาแฟริชอโรม่า') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,3,'8850127004397',110,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850127004410') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เนสกาแฟเอสเปรสโซ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,2,'8850127004410',110,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850144206576') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'คนอร์ ซุปก้อนรสหมู') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,3,'8850144206576',18.8,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850144208112') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'คนอร์โจ๊ก รสหมู  32 ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,12,'8850144208112',9.42,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850151961116') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'นมข้นตรามะลิ 355 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,6,'8850151961116',27,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850153333089') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ปลากระป๋องแมกเคอเรลสามแม่ครัว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,8,'8850153333089',19,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850153533083') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ปลาซาร์ดีนสามแม่ครัว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,10,'8850153533083',19,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157100342') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจเลไลท์กลิ่นผลไม้รวม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850157100342',4.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157100519') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจเล่บิวตี้สตอเบอร์รี่ 140กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,0,'8850157100519',8.33,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157100533') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจเล่บิวตี้กลิ่นแอปเปิ้ล 140กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8850157100533',8.33,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157100557') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจเล่บิวตี้องุ่นขาว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8850157100557',8.33,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157101448') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจเล่ไลท์สีเขียว แพ็ค 6 ถ้วย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,2,'8850157101448',25,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157400107') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เบนโตะ แดง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8850157400107',12.5,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157513760') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โลตัสหน่องไก่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8850157513760',3.92,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157550819') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำมะพร้าว เมจิกเฟรช') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,39,'8850157550819',8,'ชิ้น') returning id into v_vid;
    if 39>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,39,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850157551083') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำเฉาก๊วยเมจิคฟาร์ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,33,'8850157551083',7.69,'ชิ้น') returning id into v_vid;
    if 33>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,33,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850161160851') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โคโคแม็ก 350 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,3,'8850161160851',22.5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850161166136') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'กะทิอัมพวา ขวด 250มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,6,'8850161166136',24,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850175069102') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ไบกอน   250มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,6,'8850175069102',50.83,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850185000355') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'สำลีก้อน 40กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,24,4,'8850185000355',18.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850188210102') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โพโมส กล่อง110มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,8,'8850188210102',6.25,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850188211109') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โฟรโมทโอเมก้ารสจืด') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,10,'8850188211109',29.08,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850188242301') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โฟโมทช๊อกโกแลต165มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,8,'8850188242301',10.25,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850188900058') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โฟรโมสต์โอเมก้ารสจืด 180 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,48,11,'8850188900058',35.5,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850206011018') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซีอิ๊วขาว 1 ลิตร') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,4,'8850206011018',58,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850206070084') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซีอิ๊วหวานขวด400มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,40,3,'8850206070084',37,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850206160129') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เต้าเจียวสูตร1 350กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,3,'8850206160129',26,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850210000039') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'น้ำมันถั่วเหลืององุ่น 1 ลิตร') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,52,12,'8850210000039',48.33,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228000403') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'สปอนเซอร์250มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,10,'8850228000403',10.09,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228000779') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ซันสแน็คต้นตำรับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850228000779',4.08,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228001028') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เพียวริคุเก๊กฮวยขาว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,6,'8850228001028',9.83,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228001516') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ซันสแนคโนริ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850228001516',4.08,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228003022') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กระทิงแดงเอ็กตร้า145มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8850228003022',8.5,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228004807') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เพียวริคุพิงก์คุ สตรอเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,5,'8850228004807',9.83,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850228005286') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เพียวริคุ องุ่นเคียวโฮ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,6,'8850228005286',9.83,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850229101857') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ปลากระป๋องมงกุฏทะเล แมคเคเรล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,13,'8850229101857',12,'ชิ้น') returning id into v_vid;
    if 13>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,13,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850229102335') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ปลาซาดีนมงกุฏทะเล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,7,'8850229102335',12,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850233260298') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เภสัชบอดี้ไวท์ชมพู400มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,89,3,'8850233260298',67,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850250000365') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาแฟกระป๋องเบอร์ดี้แดง 170 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,11,'8850250000365',13.91,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850250001669') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ผงชู 72ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,18,'8850250001669',8.9,'ชิ้น') returning id into v_vid;
    if 18>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,18,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850250010944') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'รสดีหมู155 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,27,10,'8850250010944',26,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850250014980') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'อายิโนะโมะโต๊ะ 250 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,32,13,'8850250014980',29.25,'ชิ้น') returning id into v_vid;
    if 13>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,13,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850250015017') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ผงชูรส อายิโนะโมะโต๊ะ 500กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,11,'8850250015017',53.5,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850256100106') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'น้ำตาลทรายขาวมิตรผล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,11,'8850256100106',27,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850256512060') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'น้ำตาลทรายแดงมิตรผล 1 kg.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,6,'8850256512060',27,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850267112129') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'แลตตาซอย300มล กล่อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,16,'8850267112129',8.88,'ชิ้น') returning id into v_vid;
    if 16>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,16,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850277070051') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ชินจัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850277070051',4,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850292516039') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาอาบน้ำหมา แบริ่ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,150,0,'8850292516039',115,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309200135') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ฟันโอช็อคโกแลต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309200135',4.13,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309201347') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ฟันโอครีมนม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8850309201347',4.13,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309201699') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ดิวเบอร์รี่บลูเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309201699',4.21,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309201736') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ดิวเบอร์รี่สตอเบอร์รี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850309201736',4.25,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309202979') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ครีมโอช็อคโกพลัส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,2,24,'8850309202979',1.54,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309203235') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ฟันโอช็อคช็อคห่อแดง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309203235',4.13,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309203396') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โรลเลอร์โคสเตอร์รสบาร์บีคิว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309203396',4.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309204812') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ฟันโอช็อกโกแลตชิพ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8850309204812',4.13,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309204911') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฟันโอสตอเบอร์รี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309204911',4.13,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309205826') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โรลเลอร์โคสเตอร์ บาบิคิว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,34,'8850309205826',4.17,'ชิ้น') returning id into v_vid;
    if 34>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,34,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309207141') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'โรว์เลอร์โคสเตอร์สาหร่าย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,23,'8850309207141',4.17,'ชิ้น') returning id into v_vid;
    if 23>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,23,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309207639') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ทิวลี่จัมโบ้วานิลาเคลือบช็อคโกแลต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309207639',4.17,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309207646') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ทิวลี่จัโบ้วานิลาเคลือบช็อคโกแลต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,0,'8850309207646',50,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309208797') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'4866c888-a48d-4441-922e-cc2ef0653c3c'::uuid,'โรลเลอร์โคสเตอร์รสไส้กรอก') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309208797',4.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309211735') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'โรลเลอร์โคสเตอร์มินิสาหร่ายญี่ปุ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,7,'8850309211735',4.16,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309212589') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โรลเลอร์โคสเตอร์รสชิส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309212589',4.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309212916') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฟันโอคุ้กกี้แอนด์ครีม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8850309212916',4.13,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850309220805') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ลูกอมเอ็กซ์-โอ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850309220805',3.58,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850344004187') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'กะทิพร้าวหอม 1000 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,100,2,'8850344004187',73,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850367100118') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'กะทิชาวเกาะกล่อง  UHT 500 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,2,'8850367100118',47,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850372000557') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'วุ้นเส้นต้นสน 80 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,10,'8850372000557',12.8,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850389103371') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'บิวตี้ดริ้งค์ไฟเบอร์สีเขียว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,2,'8850389103371',16.17,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850389103388') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'บิวตี้ดริ้ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8850389103388',16.16,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850412374167') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'FF มะเขือเทศ 58 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,1,'8850412374167',16.67,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850412504021') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'FFมะเขือเทศ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8850412504021',4.29,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850412804220') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'FF มะเขือเทศ แบบแพ็ค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,0,'8850412804220',51.5,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850423000093') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำหวาน เฮลบูลบอย แดง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,10,'8850423000093',65,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425000077') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปีโป้12ถ้วย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8850425000077',17.5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425000169') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปีโป้ถ้วย5บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,0,'8850425000169',4.16,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425000176') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปีโป้ถ้วย5บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,6,'8850425000176',4.16,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425002910') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ยูโร่เค้กไส้ครีม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,6,'8850425002910',4.33,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425002927') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ยูโร่คัสตาส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,70,0,'8850425002927',53,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425003191') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'กัสเซนครีมช็อค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8850425003191',4.33,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425003214') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กัสเซนนม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850425003214',4.33,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425003757') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'กัสเซนมิลล์ช็อค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850425003757',4.33,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425003948') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ยูโร่ช็อคโกพาย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850425003948',4.33,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425004747') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอลเซ่กลิ่นวานิลา') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,3,14,'8850425004747',2.55,'ชิ้น') returning id into v_vid;
    if 14>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,14,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425004969') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอลเซ่กลิ่นกล้วยหอม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,3,17,'8850425004969',2.55,'ชิ้น') returning id into v_vid;
    if 17>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,17,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425005416') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอลเซ่กลิ่นราสเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,3,24,'8850425005416',2.55,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425006772') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปีโป้กัมมี่ องุ่น 5 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,20,'8850425006772',4.08,'ชิ้น') returning id into v_vid;
    if 20>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,20,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425007274') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ยูโร่ช็อคโกพายราสเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850425007274',4.33,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850425011981') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอลเซ่กลิ่นใบเตย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,70,0,'8850425011981',58.22,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850477000865') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ทรายแมว มีโอ กลิ่นเลม่อน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,96,1,'8850477000865',74,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850477009424') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'อาหารสุนัขสมาร์ทอาร์ท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,120,0,'8850477009424',95.33,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850477017030') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'มีโอ ทรายแมวกลิ่น กาแฟ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,96,1,'8850477017030',74,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850487037141') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้ำจิ๋มไก่ ตราแม่ประนอม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,39,2,'8850487037141',27,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850511321178') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซอสเมือเขือเทศ โร่ซ่า 200 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,6,'8850511321178',16.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850525115015') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'เงาะกระป๋อง MA') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,10,'8850525115015',39,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850580200039') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เบง เบง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8850580200039',3.75,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850615100129') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'อีโน่ ส้ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,24,'8850615100129',12.71,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850624144343') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาโตะรสส้ม 250 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8850624144343',7.5,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850624340998') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาโตะลิ่นจี่ 250มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,40,'8850624340998',8.05,'ชิ้น') returning id into v_vid;
    if 40>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,40,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850624395240') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาโตะรสองุ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,18,'8850624395240',8.06,'ชิ้น') returning id into v_vid;
    if 18>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,18,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850624756355') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาโตะรสแตงโม 250 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8850624756355',7.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850624756478') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'กาโตะ เมล่อน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8850624756478',8.05,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718712571') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์STAX ซาวครีมและหัวหอม แพ็ค 6 กระป๋อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,115,1,'8850718712571',105,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718800209') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ทวิสตี้เอ็กซ์ตรีม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8850718800209',4,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718801060') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ร็อคมันฝรั่งแท้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,7,'8850718801060',4.42,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718801077') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ร็อค บาร์บีคิว13กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8850718801077',4.42,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718801916') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ตะวันกุ้งกรอบ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,24,'8850718801916',4.17,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718802005') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ตะวันลาบแซ่บ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,23,'8850718802005',4.17,'ชิ้น') returning id into v_vid;
    if 23>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,23,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718802517') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์บาบิคิว25ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,4,'8850718802517',8.58,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718803996') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ร็อคหมึกย่าง 25 ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,11,'8850718803996',8.2,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718805327') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วันไบร์ทต้นตำรับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850718805327',4,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718805334') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ซันไบร์คบาบิคิว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8850718805334',4,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718809523') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ รสเมี่ยงคำ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,10,'8850718809523',8.17,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718812769') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ตะวันต้นตำรับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,19,'8850718812769',4.17,'ชิ้น') returning id into v_vid;
    if 19>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,19,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718816064') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์STAX ซาวครีมและหัวหอม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,4,'8850718816064',17.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718819454') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ร็อคออริจินอล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,23,'8850718819454',16.46,'ชิ้น') returning id into v_vid;
    if 23>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,23,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718819478') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์โนริสาหร่าย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,17,'8850718819478',16.46,'ชิ้น') returning id into v_vid;
    if 17>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,17,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718819485') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์แผ่นหยัก บาร์บีคิว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,12,'8850718819485',17.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718819515') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ซาวครีมและหัวหอม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,21,'8850718819515',16.46,'ชิ้น') returning id into v_vid;
    if 21>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,21,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718819522') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์ รสเมี่ยงคำ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,13,'8850718819522',17.16,'ชิ้น') returning id into v_vid;
    if 13>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,13,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718822232') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เลย์คลาสสิคไข่เค็ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8850718822232',4.42,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850718822614') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ตะวันรสโก่วิงค์แซ่บ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,22,'8850718822614',4.17,'ชิ้น') returning id into v_vid;
    if 22>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,22,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850813120196') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'กะทิชาวเกาะแบบขวด 250 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,6,'8850813120196',27,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850871212000') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฝอยโพลี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,12,'8850871212000',9.58,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850871301001') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ใยขัด โพลีเดลี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,17,'8850871301001',3.13,'ชิ้น') returning id into v_vid;
    if 17>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,17,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850952501245') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำส้มดีโด้ 450 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,3,'8850952501245',8,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850952503249') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำสับปะรดดีโด้ 450 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,4,'8850952503249',8,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987101014') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่ารสหมูสับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,6,'8850987101014',6.1,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987101205') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่าแพ็ค 10 ซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,75,3,'8850987101205',65,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987128301') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่าต้มยำกุ้งน้ำข้น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,20,'8850987128301',6.1,'ชิ้น') returning id into v_vid;
    if 20>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,20,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987128325') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่าต้มยำน้ำข้น 55 กรัม ยกลัง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,225,0,'8850987128325',175,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987142611') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่ารสเย็นตาโฟร') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,6,'8850987142611',6.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987143618') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'มาม่าหมูสับต้มยำน้ำข้น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,6,'8850987143618',6.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850987148651') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'4866c888-a48d-4441-922e-cc2ef0653c3c'::uuid,'มาม่าโอเครไข่เค็มแบบห่อ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8850987148651',13.17,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850999016863') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'สิงห์เล่ม่อนโซดา330มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,5,'8850999016863',14.16,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850999019123') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'สิงห์แดงเลม่อนโซดา') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,0,'8850999019123',14.16,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850999021201') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'สิงห์บ้วยเลม่อนโซดา 330มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,6,'8850999021201',14.16,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8850999321004') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้ำสิงห์600มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,7,'8850999321004',3.8,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004101208') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ปาร์ตี้ คาราเมล48 ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8851004101208',16,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004104056') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปาร์ตี้ครองแครง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,14,'8851004104056',4,'ชิ้น') returning id into v_vid;
    if 14>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,14,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004203056') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'แคมปัสช็อคโกแลต12ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,9,'8851004203056',4,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004204992') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'แคมปัสช็อคพัฟ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,14,'8851004204992',4,'ชิ้น') returning id into v_vid;
    if 14>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,14,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004401254') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตกลิ่นBBQ 42ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,9,'8851004401254',15.84,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004406051') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตปูผัดผงกะหรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8851004406051',4,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004406204') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตปูผัดผงกระหรี่42ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,4,'8851004406204',15.84,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004408055') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตปลาสามรส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8851004408055',16.67,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004416050') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตซอธ์แอนด์ซาวร์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,0,'8851004416050',4,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004416203') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เทสโตรสซอลธแอนด์ซาวร์ 42ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,4,'8851004416203',16.33,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004417057') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'เทสโตสาหร่ายญี่ปุ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,9,'8851004417057',4,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004801184') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โดโซะต้นตำรับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,7,'8851004801184',16.83,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851004899532') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โดโซะมินิกลมกล่อม12ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,23,'8851004899532',4,'ชิ้น') returning id into v_vid;
    if 23>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,23,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851012103058') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไมโล 165 มล กล่อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,8,'8851012103058',8.2,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851012103706') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เนสกาแฟกระป๋องเขียว170มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,10,'8851012103706',13.5,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016000032') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เอบิเซน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8851016000032',8.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016000537') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'บันบันรสดั้งเดิม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8851016000537',3.91,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016000643') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'แจ็คมันฝรั่งแท่ง22ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,6,6,'8851016000643',8.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016000681') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แจ็คซอสพริก') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8851016000681',4,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016000698') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'แจ็คมะเขือเทศ12ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8851016000698',4,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851016500242') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'บันบันปูผัดผงกะหรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8851016500242',3.92,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851019010304') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ป๊อกกี้รสช็อคโกแลต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,8,'8851019010304',9.5,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851019010502') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ป๊อกกี้รสสตอเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,9,'8851019010502',9.5,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851028001423') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิลค์งาดำแบบขวด 300มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,3,'8851028001423',null,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851028001553') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิลล์พลัส งาดำ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,12,'8851028001553',11.25,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851028001577') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิลค์ออริจินอล200มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,6,'8851028001577',9.25,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851028007029') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิลล์ไวต้าพลัสอัลมอน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,9,'8851028007029',11.25,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851028140047') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ไวตามิ้ลค์ทูโก') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,4,'8851028140047',14.83,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111153060') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ผ้าอนามัยคูลลิ่งเฟรช สลิม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,29,2,'8851111153060',19.5,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111175017') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'โซฟี ผ้าอนามัยแบบกางเกง M') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,75,0,'8851111175017',62,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111175031') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'โซฟี  L พรีเมียม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,75,1,'8851111175031',62,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111175147') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ผ้าอนามัยแบบกางเกง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,3,'8851111175147',54,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111412488') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มามี่โพโคแพ้นท์หญิง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,475,0,'8851111412488',445,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111414390') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มามี้โพโคแพ้นท์หญิงXL 42') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,529,0,'8851111414390',507,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111417469') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มามี่โพโคแพ้นท์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,250,0,'8851111417469',225,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851111631032') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'แผ่นซับปัสสาวะ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,79,1,'8851111631032',73.33,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851123212021') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'M150 ไฮวิตามินB12') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,20,'8851123212021',10.5,'ชิ้น') returning id into v_vid;
    if 20>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,20,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851123238007') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'คาลพิสแลคโตะโซดา') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,6,'8851123238007',12.84,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851123703468') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งเด็กเบบี้มายด์ สวีทตี้ พิงค์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,4,'8851123703468',25,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851123782067') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้ำหอมทเวลพลัส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,0,'8851123782067',28,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851234310012') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'กรีนนัทรสปลาหมึก 17 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8851234310012',5.75,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851234310067') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'กรีนนัทรสกุ้ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8851234310067',5.75,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851447010006') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ยาดมโป๊ยเซียน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,10,'8851447010006',15.75,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851473001443') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ซาร่าพาราเซตามอล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,15,'8851473001443',12.5,'ชิ้น') returning id into v_vid;
    if 15>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,15,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851613101378') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'กะทิอร่อยดีแบบกล่อง 250มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,7,'8851613101378',26,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851683000533') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'พริกไทยบ่น ตราจันท์ 50กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,7,'8851683000533',18,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851717020117') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โยเกิร์ตวุ้นสตอเบอร์รี่ แบบถ้วย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8851717020117',13,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851717020148') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'โยเกิร์ตวุ้นมะพร้าว แบบถ้วย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8851717020148',13,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851717040016') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ดัชมิลล์สตรอเบอรี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,13,12,'8851717040016',9.5,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851717040023') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ดัชมิลล์ส้ม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,13,12,'8851717040023',9.5,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851717040030') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ดัชมิลล์ผลไม้รวม 165 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,10,'8851717040030',9.5,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727001052') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โปเต้ 52 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8851727001052',16.67,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727002028') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ปาปริก้า') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8851727002028',4.17,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727002059') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ปาปิก้า52กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8851727002059',16.67,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727003025') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'คอนเน่ 23ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,4,'8851727003025',10,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727003056') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'คอนเน่ 46ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,6,'8851727003056',16.67,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851727003254') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'คอนเน่รสชีส 20 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8851727003254',17.33,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851753098798') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มอคโคน่าเอสเปรทโซ่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,2,'8851753098798',108,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851753099054') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มอคโคน่าริชแอนด์สมูส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,125,2,'8851753099054',108,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851818101012') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แอทแทคอีซี่แฮปปี้สวีท 700ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,45,2,'8851818101012',36,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851818209015') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แอทแทคอีซี่ ซากุระสวีท800.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,45,2,'8851818209015',36,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851818801561') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แอทแทคอีซี่แมชชีน600') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,45,2,'8851818801561',36,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932187428') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ซันไลต์เลมอนเทอร์โบว์ 500มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,29,3,'8851932187428',22.25,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932272414') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'บรีสเอกเซล พิงค์โรซี่ ฟลอรัล 550 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,17,'8851932272414',32.78,'ชิ้น') returning id into v_vid;
    if 17>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,17,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932353854') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'แชมพู ซันซิล ส้ม 350 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,140,1,'8851932353854',129,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932354264') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ครีมนวด ซันซิล สีชมพู') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,140,1,'8851932354264',129,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932461368') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'พอนด์ส ไบรท์ มิราเคิล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,16,'8851932461368',10.5,'ชิ้น') returning id into v_vid;
    if 16>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,16,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932471473') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โลชั่นซิต้า110มลชมพู') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,3,'8851932471473',31.66,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932471862') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ชิตร้า เอเอชเอ เพร์ล ยูวี') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,59,1,'8851932471862',45,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932487276') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาปรับผ้านุ่ม คอมฟอร์ท โคเรียน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8851932487276',10,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851932488860') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาซักผ้าโอโม ซากุระ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8851932488860',10,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851952350161') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำดื่ม คริสตัล 600มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,31,'8851952350161',4.5,'ชิ้น') returning id into v_vid;
    if 31>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,31,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851954101266') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซอสปรุงรสฝาเขียว500มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,40,10,'8851954101266',30.8,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851954103116') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซอสพริกภูเขาทอง230กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,3,'8851954103116',13,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959004715') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โค๊กขวด245มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,11,'8851959004715',8.91,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959122921') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'มินิเมดสแปลช 250 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,13,12,'8851959122921',10,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959130711') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำดื่ม น้ำทิพย์ 770มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,11,'8851959130711',7.5,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132012') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โค๊กกระป๋อง325มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,4,'8851959132012',14.16,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132166') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'แฟนต้ากระป๋องส้ม 325 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,5,'8851959132166',14,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132173') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'แฟนต้าน้ำแดงกระป๋อง 325มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,6,'8851959132173',14,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132180') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'แฟนต้ากระป๋องเขียว325มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,16,6,'8851959132180',14,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132364') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'สไปร์เลม่อนไลม์ 325 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,12,'8851959132364',14.16,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851959132678') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'ชเวปส์มะนาวโซดา 330มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,6,'8851959132678',15,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851989033396') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาซักผ้า fineline 1250 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,135,2,'8851989033396',89.5,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851989036922') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาปรับผ้านุ่ม fineline') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,0,'8851989036922',10,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851989040202') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาถูพื้น โทมิ 800 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,70,1,'8851989040202',55,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851989060835') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ดีนี้คิดส์สบู่เหลวสีชมพู') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,119,0,'8851989060835',65,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8851989080611') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ครีมอาบน้ำ Benice เขียว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,55,12,'8851989080611',40,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852023664200') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'โก๋แก่ ห่อเล็ก 17 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,9,'8852023664200',4.16,'ชิ้น') returning id into v_vid;
    if 9>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,9,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852023664507') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'โก๋แก่75กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,7,'8852023664507',16.3,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852023664750') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ถั่วลิสงโก๋แก่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,0,'8852023664750',16,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852044110267') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ทาโร่รสเข้มข้น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8852044110267',17.33,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852044110366') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ทาโร่ BBQ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,4,'8852044110366',17.33,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852047326214') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'TOROเนย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,4,'8852047326214',17.25,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852047326795') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'TOROอัลมอน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,2,'8852047326795',17.25,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052110402') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฮานามิรสดั้งเดิม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8852052110402',8.17,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052111300') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฮานามิฮอตชิลลี่13ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,21,'8852052111300',4,'ชิ้น') returning id into v_vid;
    if 21>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,21,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052112109') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ฮานามิกุ้งกระเทียมพริกไทย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8852052112109',4,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052114301') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ฮานามิรสสาหร่าย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8852052114301',4,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052220101') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'สแนคแจ็ครสดั้งเดิม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,4,'8852052220101',4,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852052220408') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สแน็คแจ๊คถั่วลันเตา 62 ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,13,'8852052220408',17.38,'ชิ้น') returning id into v_vid;
    if 13>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,13,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852240010026') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เจ้าสัว ข้าวตังหน้าตั้ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,4,'8852240010026',40,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852522019457') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โฟมล้างหน้าไบโอนิค เฟเชียลโฟม แอคเน่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,3,'8852522019457',45,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852522035587') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โฟมล้างหน้าไบโอนิค กรีนที') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,2,'8852522035587',48,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852633330106') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งทอดกรอบครัววังทิพย์ 100 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,12,'8852633330106',6.83,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852633330502') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'แป้งทอดกรอบ ครัววังทิพย์ 500 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,40,2,'8852633330502',32,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8852909701432') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'หมอนwinnie the pooh') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,799,0,'8852909701432',199,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853002080066') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ดีน่างาดำกล่อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,1,'8853002080066',8.25,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853002301857') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ดีน่ากาบากล่อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,4,'8853002301857',8.25,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853002303097') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ดีมอลต์3in1') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,145,1,'8853002303097',109,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853301140812') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'วิสกัสปลาทะเลนม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,159,0,'8853301140812',129,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853333000436') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มาลีกระป๋อง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,120,0,'8853333000436',105,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853333017014') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มาลีลิ้นจี่แบบกล่อง 180มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,6,'8853333017014',10.3,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8853333017625') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มาลีสตอเบอร์รี่แบบกล่อง180มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,5,'8853333017625',10.33,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854334000241') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ฟ้าไทยผงปรุงรส รสหมู 800 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,90,6,'8854334000241',70.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854334002498') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ฟ้าไทย น้ำก๋วยเตี๋ยวสำเร็จรูปเข้มข้น 270 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,29,6,'8854334002498',23.33,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854334002603') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ผงปรุงรสฟ้าไทย 75 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,12,10,'8854334002603',8.7,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854334002931') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ผงปรุงรสฟ้าไทยรสหมู สีฟ้า165กรัม แบบแพ็ค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,155,0,'8854334002931',120,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854334003686') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้ำก๋วยเตี๋ยวฟ้าไทย 350กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,190,0,'8854334003686',162,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698010672') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิกระป๋อง ยาคูซ่า 320มล เลม่อนฮันนี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,4,'8854698010672',12.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698014281') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิเคียวโฮ 370 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,4,'8854698014281',12.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698014359') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิ รสน้ำผึ้งมะนาว 370 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,12,'8854698014359',12.5,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698014458') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิกรีนที ต้นตำรับ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,6,'8854698014458',11.67,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698014588') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิ รสข้าวญี่ปุ่น 370 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,6,'8854698014588',12.5,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698015554') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิรสแตงโม 370 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,5,'8854698015554',12.5,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854698016933') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โออิชิชาคูซ่ากระป๋องรสองุ่น 320 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,5,'8854698016933',12.5,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8854923314308') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สแน็คแจ็คหอยเชล์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,5,'8854923314308',17.34,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8855120002647') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'บิ๊กแบ๊กรสมะเขือเทศ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8855120002647',16,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8855120003002') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'บิ๊กแบ็กสาหร่าย 20 บาท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8855120003002',16,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8855120003095') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'บิ๊กแบ๊กซาวครีมและหัวหอม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8855120003095',16,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8855790000011') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'คาราบาวแดง150มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,24,'8855790000011',8.5,'ชิ้น') returning id into v_vid;
    if 24>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,24,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857107230159') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สาหร่าย เถ้าแก่น้อย 10 กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8857107230159',17.5,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857107232030') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เถ้าแก่น้อยคลาสสิค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,0,'8857107232030',4.58,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857107232047') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เถ้าแก่น้อยรสเผ็ด.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8857107232047',4.58,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857129037262') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาซักผ้าซีเมอเมด') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,5,'8857129037262',18,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857129037286') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'น้ำยาซักผ้าเดียนี่ 2 ลิตร') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,79,2,'8857129037286',59,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8857200585507') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ก๋วยเตี๋ยวเลอรส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,28,10,'8857200585507',24,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279001028') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วอยซ์วาฟเฟิลคริสปี้ 21ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8858279001028',3.75,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279001394') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'วอยซ์วาฟเฟิลช็อคโก้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,48,2,'8858279001394',34,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279001875') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วอยซ์สตอเบอร์รี่') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8858279001875',3.75,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279001936') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วอยซ์ครีมมี่บัตเตอร์ 24ก.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8858279001936',3.75,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279001943') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วอยซ์ครีมมี่บัตเตอร์ แพค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,48,2,'8858279001943',34,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279002124') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ซูโม่ครีมช็อคโก') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8858279002124',3.75,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279002278') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ซูโม่คุกกี้ครีม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8858279002278',3.75,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279002957') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'วอยซ์วาฟเฟิลคุกกี้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,11,'8858279002957',3.75,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858279003527') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วอยร์วาฟเฟิลกลิ่นบัตเตอร์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,8,'8858279003527',3.75,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858678423469') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'กระดาษทิชชู มายด์เหมียว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,3,'8858678423469',15,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858702410304') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เถ้าแก่น้อยย่างบิ๊กโลวคลาสิค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,6,7,'8858702410304',4.58,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858702410311') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เถ้าแก่น้อยบิ๊กโลวเผ็ด') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8858702410311',4.58,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858702410335') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สาหร่ายม่วน บิ๊กโลว์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,2,'8858702410335',55,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858702410342') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สาหร่าย bigroll รสเผ็ด') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,1,'8858702410342',55,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858702434027') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'สาหร่ายแผ่นใหญ่ เถ้าแก่น้อย') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,0,'8858702434027',55,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858817011151') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ถุงร้อน6*9แพ็ค500กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,45,7,'8858817011151',38,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858817011168') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ถุงร้อน6*10แพ็ค500กรัม') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,45,7,'8858817011168',38,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858817011915') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ถุงหิ้วไฮโซ 6*14') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,8,'8858817011915',42,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858817011922') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ถุงหิ้วไฮโซ 8*16') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,69,8,'8858817011922',42,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891301728') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เย็ยเย็น เก๊กฮวย400มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,2,'8858891301728',12,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891301872') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'อิชิตันรสน้ำผึ้งมะนาว 280 มล.') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,6,'8858891301872',8.67,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891302411') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'อิชิตันรสข้าวญี่ปุ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8858891302411',8.67,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891302473') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เย็นเย็นจับเลี้ยง 315 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,2,'8858891302473',9,'ชิ้น') returning id into v_vid;
    if 2>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,2,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891302701') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เย็นเย็นเก๊กฮวย 315 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8858891302701',9,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858891306402') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'น้ำด่าง อิชิตัน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,20,13,'8858891306402',16.5,'ชิ้น') returning id into v_vid;
    if 13>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,13,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858935382508') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำส้ม สายชู อสร 250มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,5,'8858935382508',12.33,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858977001108') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เคลียโนสซอง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,10,'8858977001108',37,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858977423221') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เคลียร์โนส กันแดด ซอง 7 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,49,4,'8858977423221',37,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858981500901') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'น้ำปลาร้าไมค์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,35,4,'8858981500901',31,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998573196') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เป๊ปซี่ 330มล*6 แพ็ค') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,90,0,'8858998573196',69,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998581559') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เป๊ปซี่กระป๋อง325 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,17,5,'8858998581559',13.3,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998581689') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เป๊ปซี่ 330 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,1,'8858998581689',11.5,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998582013') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'มิรินด้า กลิ่นส้ม 345 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,5,'8858998582013',8.75,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998582068') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำแดง มิรินด้า 345 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,7,'8858998582068',8.75,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998582556') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำเขียวมิรินด้า 345 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,7,'8858998582556',8.75,'ชิ้น') returning id into v_vid;
    if 7>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,7,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998585410') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ลิปตันเลม่อนกระป๋อง325มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,16,6,'8858998585410',13,'ชิ้น') returning id into v_vid;
    if 6>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,6,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8858998586394') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'เป๊ปซี่ 250 มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,3,'8858998586394',9.08,'ชิ้น') returning id into v_vid;
    if 3>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,3,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8859311599046') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ทิชชูคุมะแบบแผ่น') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,25,0,'8859311599046',20,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8859389701891') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'มินิโคนช็อคโกแลต') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,7,11,'8859389701891',5.6,'ชิ้น') returning id into v_vid;
    if 11>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,11,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8859455010155') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'ถุงร้อนใส 7*11') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,1,'8859455010155',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8859562218079') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'กล่องข้าวเอลซ่า') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,99,5,'8859562218079',67,'ชิ้น') returning id into v_vid;
    if 5>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,5,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8859691919762') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ผ้าห่มเอลซ่า') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,299,1,'8859691919762',166,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8886015402037') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ชูก้าร์ไลค์') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,10,10,'8886015402037',8.58,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8888') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'ไม้กวาดแข็ง') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,65,8,'8888',65,'ชิ้น') returning id into v_vid;
    if 8>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,8,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8992760121014') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โอริโอ') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,10,'8992760121014',4.13,'ชิ้น') returning id into v_vid;
    if 10>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,10,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8996001350805') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'Go Choco') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,3,0,'8996001350805',2.8,'ชิ้น') returning id into v_vid;
    if 0>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,0,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8996001350881') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'ทวินช็อคโก้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,4,'8996001350881',3.92,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8996001350898') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'06ff8ced-559f-42ba-bb69-f63da3b31946'::uuid,'ซุปเปอร์สตาร์ ทวิน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,60,1,'8996001350898',50,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8996001354001') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'41c0695a-9c15-471e-a8fb-828dde6fd69c'::uuid,'คาลพาช็อกโกแลตมะพร้าว') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,12,'8996001354001',4.33,'ชิ้น') returning id into v_vid;
    if 12>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,12,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='8996001375242') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'โชกี้โชกี้') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,15,'8996001375242',3.91,'ชิ้น') returning id into v_vid;
    if 15>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,15,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9300830020218') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เรโซน่า กระป๋องสีฟ้า') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,110,4,'9300830020218',82.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9300830020232') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'เรโซน่าสเปย์ ชมพู') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,110,4,'9300830020232',82.5,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9334214022833') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'วิสกัสสเต็กแซลม่อน') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,159,1,'9334214022833',129,'ชิ้น') returning id into v_vid;
    if 1>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,1,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9556031084263') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'99d4f35f-e385-4aa2-9938-b1f1c6d4dc4f'::uuid,'สบู่โพรเทค พรอพโพลิส') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,15,4,'9556031084263',9.8,'ชิ้น') returning id into v_vid;
    if 4>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,4,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9556121031382') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,null,'จูลี่ พีนัท') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,5,16,'9556121031382',3.92,'ชิ้น') returning id into v_vid;
    if 16>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,16,'admin_adjust'); end if;
  end if;
  if not exists (select 1 from product_variants where barcode='9999') then
    insert into products(shop_id,category_id,name) values('00000000-0000-0000-0000-0000000000a1'::uuid,'d1becf38-c235-44e0-9f8e-2b53f04b934e'::uuid,'น้ำดื่มAvila600มล') returning id into v_pid;
    insert into product_variants(product_id,price,stock_qty,barcode,cost_price,unit) values(v_pid,30,84,'9999',26,'ชิ้น') returning id into v_vid;
    if 84>0 then insert into stock_movements(variant_id,delta_stock,reason) values(v_vid,84,'admin_adjust'); end if;
  end if;
end $$;
