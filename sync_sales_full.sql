-- SYNC VENDITE APPSHEET → BRAINWARE (High Street, 1-4 Giugno)
-- Eseguire su Supabase SQL Editor

-- STEP 1: Create tables (drop if exist from previous run)
DROP TABLE IF EXISTS tmp_items;
DROP TABLE IF EXISTS tmp_inv;
CREATE TABLE tmp_inv (n int, ts timestamptz, pay text, total numeric, ref text, cust text, ch text, mv text);
CREATE TABLE tmp_items (n int, pname text, qty int, price numeric);

-- STEP 2: Invoice data (n, timestamp, payment, total, referente, customer, channel, movement_type)
INSERT INTO tmp_inv VALUES
(2,'2026-06-01 12:02:30+02','cash',70,'Peppe','ragazzi ita','walk-in','sale'),
(3,'2026-06-01 13:07:19+02','cash',64,'Peppe','TUNESI','walk-in','sale'),
(4,'2026-06-01 13:08:17+02','cash',60,'Peppe','GRUPPO','google','sale'),
(5,'2026-06-01 13:08:17+02','pos',36,'Peppe',NULL,'google','sale'),
(6,'2026-06-01 13:12:56+02','pos',101,'Peppe',NULL,'google','sale'),
(7,'2026-06-01 22:18:11+02','cash',50,'Andrea','Amsterdam','google','sale'),
(8,'2026-06-01 22:20:37+02','split',68,'Andrea','Uk','google','sale'),
(9,'2026-06-01 22:22:05+02','cash',60,'Andrea','Indian','google','sale'),
(10,'2026-06-01 22:26:54+02','cash',63,'Andrea','Ita','google','sale'),
(11,'2026-06-01 22:27:51+02','pos',3,'Andrea','Ita','google','sale'),
(12,'2026-06-01 22:28:41+02','pos',60,'Andrea','Francesi','google','sale'),
(13,'2026-06-01 22:29:43+02','pos',28,'Lorenzo','Usa','google','sale'),
(14,'2026-06-01 22:30:59+02','cash',33,'Andrea','Australia','google','sale'),
(15,'2026-06-01 22:32:14+02','pos',60,'Lorenzo','Saudi','google','sale'),
(16,'2026-06-01 22:34:26+02','cash',55,'Lorenzo','Uk','google','sale'),
(17,'2026-06-01 22:35:27+02','cash',60,'Andrea','Portoghese','google','sale'),
(18,'2026-06-01 22:36:25+02','pos',100,'Andrea','Est','google','sale'),
(19,'2026-06-01 22:37:46+02','pos',30,'Andrea','Saudi','google','sale'),
(20,'2026-06-01 22:39:05+02','pos',50,'Andrea','Francesi','google','sale'),
(21,'2026-06-01 22:39:46+02','cash',50,'Andrea','Colombia','google','sale'),
(22,'2026-06-01 22:41:01+02','split',30,'Andrea','Uk','google','sale'),
(23,'2026-06-01 22:41:54+02','pos',30,'Andrea','Australia','google','sale'),
(24,'2026-06-01 22:42:36+02','pos',40,'Andrea','Uk','google','sale'),
(25,'2026-06-01 22:43:49+02','pos',55,'Andrea','Esp','google','sale'),
(26,'2026-06-01 22:44:36+02','pos',150,'Andrea','Uk','google','sale'),
(27,'2026-06-01 22:46:01+02','pos',60,'Andrea','Local','google','sale'),
(28,'2026-06-01 22:47:46+02','pos',33,'Andrea','Arab','google','sale'),
(29,'2026-06-01 22:48:42+02','pos',30,'Andrea','Ita','google','sale'),
(30,'2026-06-01 22:49:09+02','pos',30,'Andrea','Ita','google','sale'),
(31,'2026-06-01 22:50:05+02','cash',60,'Andrea','Local','google','sale'),
(32,'2026-06-01 22:51:04+02','pos',30,'Andrea','Arabo','google','sale'),
(33,'2026-06-01 22:52:03+02','cash',50,'Andrea','Uk','google','sale'),
(34,'2026-06-01 22:54:05+02','pos',60,'Andrea','Ita','google','sale'),
(35,'2026-06-01 22:54:38+02','pos',25,'Andrea','Uk','google','sale'),
(36,'2026-06-01 22:55:15+02','pos',35,'Andrea','Francesi','google','sale'),
(37,'2026-06-01 23:43:52+02','other',0,'Andrea','Autoconsumo adam','google','autoconsumo'),
(38,'2026-06-01 23:45:15+02','cash',70,'Andrea','Tedeschi','google','sale'),
(39,'2026-06-01 23:45:52+02','pos',30,'Andrea','Esp','google','sale'),
(40,'2026-06-01 23:46:29+02','pos',30,'Andrea','Ita','google','sale'),
(41,'2026-06-01 23:46:29+02','pos',30,'Andrea','Sud america','google','sale'),
(42,'2026-06-02 11:24:40+02','cash',30,'Lorenzo','Polacchi','google','sale'),
(43,'2026-06-02 11:36:18+02','pos',50,'Lorenzo','Uk','google','sale'),
(44,'2026-06-02 12:09:57+02','pos',52,'Lorenzo','Usa','google','sale'),
(45,'2026-06-02 12:22:21+02','cash',30,'Lorenzo','Uk','google','sale'),
(46,'2026-06-02 13:00:09+02','cash',53,'Lorenzo','Spagnole','google','sale'),
(47,'2026-06-02 13:49:11+02','cash',100,'Lorenzo','Uk','google','sale'),
(48,'2026-06-02 13:52:10+02','pos',5,'Lorenzo','Araba','google','sale'),
(49,'2026-06-02 14:57:38+02','pos',200,'Lorenzo','#5421','shopify','sale'),
(50,'2026-06-02 14:58:37+02','cash',63,'Lorenzo','Ita','google','sale'),
(51,'2026-06-02 16:30:39+02','pos',33,'Lorenzo','Portoghese','google','sale'),
(52,'2026-06-02 16:42:45+02','pos',28,'Lorenzo','Rumena','google','sale'),
(53,'2026-06-02 17:02:36+02','pos',25,'Lorenzo','Francese','google','sale'),
(54,'2026-06-02 17:45:26+02','cash',30,'Lorenzo','Italiano','google','sale'),
(55,'2026-06-02 18:01:30+02','cash',33,'Lorenzo','Francese','google','sale'),
(56,'2026-06-02 19:04:54+02','pos',153,'Lorenzo','Uk','google','sale'),
(57,'2026-06-02 19:06:53+02','pos',27,'Lorenzo','Usa','google','sale'),
(58,'2026-06-02 19:08:20+02','pos',40,'Lorenzo','Spagnoli','google','sale'),
(59,'2026-06-02 19:09:47+02','pos',40,'Lorenzo','Usa','google','sale'),
(60,'2026-06-02 19:12:24+02','pos',95,'Lorenzo','Cinese','google','sale'),
(61,'2026-06-02 19:13:22+02','cash',50,'Lorenzo','Italiani','google','sale'),
(62,'2026-06-02 19:14:02+02','pos',90,'Lorenzo',NULL,'google','sale'),
(63,'2026-06-02 19:15:28+02','pos',130,'Lorenzo','Local','walk-in','sale'),
(64,'2026-06-02 19:16:25+02','pos',30,'Lorenzo','Local','walk-in','sale'),
(65,'2026-06-02 19:43:04+02','pos',50,'Lorenzo','Uk','google','sale'),
(66,'2026-06-02 19:50:58+02','pos',40,'Lorenzo','Usa','google','sale'),
(67,'2026-06-02 20:03:32+02','pos',33,'Lorenzo','Local','walk-in','sale'),
(68,'2026-06-02 20:46:30+02','cash',30,'Lorenzo','Georgia','google','sale'),
(69,'2026-06-02 20:52:19+02','pos',65,'Lorenzo','Local','walk-in','sale'),
(70,'2026-06-02 20:59:18+02','cash',25,'Lorenzo','Ciprioti','google','sale'),
(71,'2026-06-02 21:52:53+02','pos',50,'Lorenzo','Uk','google','sale'),
(72,'2026-06-03 10:59:38+02','cash',65,'Lorenzo','Local','walk-in','sale'),
(73,'2026-06-03 11:00:31+02','other',30,'Lorenzo','Autoconsumo lorenzo','google','autoconsumo'),
(74,'2026-06-03 11:39:23+02','cash',33,'Lorenzo','Irlandesi','google','sale'),
(75,'2026-06-03 11:52:34+02','pos',31,'Lorenzo','Uk','google','sale'),
(76,'2026-06-03 11:53:43+02','cash',10,'Lorenzo',NULL,'google','sale'),
(77,'2026-06-03 15:03:04+02','pos',100,'Lorenzo','Turchi','google','sale'),
(78,'2026-06-03 15:17:54+02','cash',25,'Lorenzo','Uk','walk-in','sale'),
(79,'2026-06-03 15:57:59+02','pos',9,'Lorenzo','Tedesca','google','sale'),
(80,'2026-06-03 16:10:45+02','pos',130,'Lorenzo','#5418','shopify','sale'),
(81,'2026-06-03 16:28:15+02','pos',40,'Lorenzo','Uk','google','sale'),
(82,'2026-06-03 16:45:26+02','pos',30,'Lorenzo','Local','walk-in','sale'),
(83,'2026-06-03 17:21:54+02','pos',100,'Lorenzo','Francesi','google','sale'),
(84,'2026-06-03 17:22:44+02','pos',100,'Lorenzo','Usa','google','sale'),
(85,'2026-06-03 17:23:34+02','pos',68,'Lorenzo','Francese','google','sale'),
(86,'2026-06-03 17:30:27+02','pos',65,'Lorenzo','Local','google','sale'),
(87,'2026-06-03 17:48:42+02','pos',25,'Lorenzo','Brasiliano','walk-in','sale'),
(88,'2026-06-03 18:06:17+02','pos',25,'Lorenzo','Local','google','sale'),
(89,'2026-06-03 18:50:29+02','pos',33,'Lorenzo','Uk','google','sale'),
(90,'2026-06-03 18:53:32+02','pos',25,'Lorenzo','Local','google','sale'),
(91,'2026-06-03 18:54:22+02','cash',30,'Lorenzo','Ita','google','sale'),
(92,'2026-06-03 18:58:42+02','pos',100,'Lorenzo','Tedeschi','google','sale'),
(93,'2026-06-03 19:09:38+02','cash',30,'Lorenzo','Uk','google','sale'),
(94,'2026-06-03 20:18:49+02','cash',3,'Lorenzo','Arabo','google','sale'),
(95,'2026-06-03 20:49:47+02','pos',60,'Lorenzo','Usa','google','sale'),
(96,'2026-06-03 21:02:52+02','pos',65,'Lorenzo','Local','walk-in','sale'),
(97,'2026-06-03 21:37:16+02','pos',40,'Lorenzo','Pakistan','google','sale'),
(98,'2026-06-03 21:44:20+02','pos',27,'Lorenzo','Austriaco','google','sale'),
(99,'2026-06-03 21:44:49+02','pos',65,'Lorenzo','Francese','google','sale'),
(100,'2026-06-03 22:07:16+02','pos',25,'Lorenzo','Macedone','referral','sale'),
(101,'2026-06-04 11:29:02+02','cash',30,'Adam','Serbia','walk-in','sale'),
(102,'2026-06-04 11:30:01+02','cash',65,'Adam','Libia','walk-in','sale'),
(103,'2026-06-04 11:30:57+02','pos',150,'Adam','Uk tourist','walk-in','sale'),
(104,'2026-06-04 11:34:57+02','cash',20,'Adam','Local','walk-in','sale'),
(105,'2026-06-04 11:44:42+02','cash',35,'Adam','Russia','walk-in','sale'),
(106,'2026-06-04 11:50:20+02','pos',30,'Adam','Spain','walk-in','sale'),
(107,'2026-06-04 12:20:43+02','pos',63,'Adam','Croazia','walk-in','sale'),
(108,'2026-06-04 13:05:52+02','pos',138,'Adam','Germania','walk-in','sale'),
(109,'2026-06-04 13:08:41+02','cash',5,'Adam','Uk tourist','walk-in','sale'),
(110,'2026-06-04 13:10:51+02','pos',30,'Adam','Local','walk-in','sale'),
(111,'2026-06-04 14:42:35+02','cash',25,'Lorenzo','Libia','walk-in','sale'),
(112,'2026-06-04 14:43:33+02','cash',50,'Adam','Georgia','walk-in','sale'),
(113,'2026-06-04 14:45:40+02','cash',38,'Adam','Uk tourist','walk-in','sale'),
(114,'2026-06-04 14:47:37+02','pos',35,'Adam','Uk','walk-in','sale'),
(115,'2026-06-04 14:49:01+02','cash',30,'Adam','Spain','walk-in','sale'),
(116,'2026-06-04 15:04:34+02','pos',20,'Adam','Uk','walk-in','sale'),
(117,'2026-06-04 15:22:44+02','cash',30,'Adam','Local stefano','walk-in','sale'),
(118,'2026-06-04 15:23:15+02','pos',65,'Adam','Local stefano','walk-in','sale'),
(119,'2026-06-04 15:35:37+02','pos',40,'Adam','Brasil','walk-in','sale'),
(120,'2026-06-04 15:57:18+02','pos',30,'Adam','Local','walk-in','sale'),
(121,'2026-06-04 16:04:15+02','pos',30,'Adam','India','walk-in','sale'),
(122,'2026-06-04 16:36:19+02','pos',40,'Adam','Uk black','walk-in','sale'),
(123,'2026-06-04 17:15:58+02','pos',25,'Adam','Francia','walk-in','sale'),
(124,'2026-06-04 17:26:47+02','pos',33,'Adam','Marocco','walk-in','sale'),
(125,'2026-06-04 18:27:42+02','cash',50,'Adam','Romania','walk-in','sale'),
(126,'2026-06-04 18:40:35+02','cash',30,'Adam','Ita','walk-in','sale'),
(127,'2026-06-04 19:17:22+02','pos',65,'Adam','Tunisia','walk-in','sale'),
(128,'2026-06-04 19:54:00+02','pos',27,'Adam','Uk tourist','walk-in','sale'),
(129,'2026-06-04 19:54:52+02','pos',30,'Adam','India','walk-in','sale'),
(130,'2026-06-04 20:41:52+02','cash',30,'Adam','Uk jamaica','walk-in','sale'),
(131,'2026-06-04 20:43:29+02','pos',79,'Adam','Uk jamaica','walk-in','sale'),
(132,'2026-06-04 20:44:22+02','pos',50,'Adam','Canada','walk-in','sale'),
(133,'2026-06-04 20:45:08+02','pos',30,'Adam','Local Poliziotto','walk-in','sale'),
(134,'2026-06-04 21:46:27+02','pos',75,'Adam','Tourist','walk-in','sale'),
(135,'2026-06-04 21:47:58+02','cash',25,'Adam','Tourist','walk-in','sale'),
(136,'2026-06-04 22:55:20+02','other',133,'Lorenzo','Lorenzo','google','autoconsumo'),
(137,'2026-06-04 22:56:01+02','cash',65,'Adam','Adam 65','walk-in','sale'),
(138,'2026-06-04 22:58:22+02','other',3,'Adam','Adam','walk-in','autoconsumo');
-- PART 2: Items data
INSERT INTO tmp_items VALUES
(2,'dry sift 5g',1,65),(2,'cartine no logo',1,3),(2,'Actitube filtri pack of 10 pcs',1,3),
(3,'dry sift 5g',1,65),
(4,'dry sift 2g',1,30),(4,'Lemon weed 2g',1,25),(4,'Grinder MM',1,5),
(5,'OG Kush 3G',1,30),(5,'Cartine MM',1,3),(5,'Clipper Accendino',1,3),
(6,'Lemon hash 2g',1,30),(6,'Cherry Pie 3g',1,30),(6,'Grinder MM',1,5),(6,'dry sift 2g',1,30),(6,'Clipper Accendino',1,3),
(7,'Lemon hash 2g',1,30),
(8,'Lemon hash 2g',1,30),(8,'Lemon weed 3g',1,30),(8,'Hemp Cones + Glass Tip',1,5),(8,'Clipper Accendino',1,3),
(9,'Bubble Hash 5g',1,65),
(10,'Lemon hash 2g',1,30),(10,'Clipper Accendino',1,3),(10,'Lemon hash 2g',1,30),
(11,'Clipper Accendino',1,3),
(12,'dry sift 2g',2,30),
(13,'Mexican Strong Pre-roll',1,25),(13,'Clipper Accendino',1,3),
(14,'Gelato 2g',1,25),(14,'Cartine MM',1,3),(14,'Grinder MM',1,5),
(15,'OG Kush 3G',2,30),
(16,'Bubble Hash 2g',1,30),(16,'Runtz 2g',1,25),
(17,'Gelato 3g',1,30),(17,'Lemon weed 3g',1,30),(17,'OG Kush 3G',1,30),
(18,'Vape Disposable 2ml',1,100),
(19,'Single Pre Roll',2,15),
(20,'Trance-E (Happy Caps) DISPLAY',1,20),(20,'Lemon hash 2g',1,30),
(21,'Spaghetti Cheese 3g',1,30),
(22,'Bubble Hash 2g',1,30),
(23,'Box da 3 Pre-roll',1,30),
(24,'Strong Cannabis Gummies MM',1,40),
(25,'Mango 5g',1,50),(25,'Grinder MM',1,5),(25,'Cartine MM',1,3),
(26,'Vape Disposable 2ml',2,100),
(27,'Cherry Pie 3g',1,30),(27,'Runtz 3g',1,30),(27,'Amnesia 3g',1,30),
(28,'Bubble Hash 2g',1,30),(28,'Cartine MM',1,3),
(29,'Lemon hash 2g',1,30),
(30,'Lemon hash 2g',1,30),
(31,'Cherry Pie 3g',1,30),(31,'Amnesia 3g',1,30),(31,'Gelato 3g',1,30),
(32,'Bubble Hash 2g',1,30),
(33,'Bubble Hash 2g',1,30),(33,'Spaghetti Cheese 2g',1,25),
(34,'Bubble Hash 2g',1,30),(34,'dry sift 2g',1,30),(34,'Cartine MM',1,3),
(35,'Mexican Strong Pre-roll',1,25),
(36,'Box da 3 Pre-roll',1,30),(36,'Grinder MM',1,5),
(37,'Bubble Hash 10g',1,130),
(38,'OG Kush 2G',1,25),(38,'Lemon hash 2g',1,30),(38,'Kit Pipe + Grinder',1,15),
(39,'dry sift 2g',1,30),
(40,'Lemon hash 2g',1,30),
(41,'Mango 3g',1,30),
(42,'dry sift 2g',1,30),
(43,'Bubble Hash 2g',1,30),(43,'Amnesia 2g',1,25),
(44,'Box da 3 Pre-roll',2,30),(44,'Accendino MM',1,2),
(45,'Bubble Hash 2g',1,30),(45,'Cartine MM',1,3),
(46,'Lemon weed 2g',1,25),(46,'Lemon hash 2g',1,30),(46,'Cartine MM',1,3),
(47,'Vape Disposable 2ml',1,100),
(48,'Bob my Box',1,5),
(49,'Gelato 5g',4,50),
(50,'Bubble Hash 2g',1,30),(50,'dry sift 2g',1,30),(50,'Cartine MM',1,3),
(51,'Lemon weed 3g',1,30),(51,'Cartine MM',1,3),
(52,'Lemon weed 2g',1,25),(52,'Cartine MM',1,3),
(53,'Mango 2g',1,25),
(54,'Lemon hash 2g',1,30),
(55,'Lemon hash 2g',1,30),(55,'Cartine MM',1,3),
(56,'OG Kush 5G',1,50),(56,'Clipper Accendino',1,3),(56,'Amnesia 3g',1,30),(56,'Lemon weed 3g',1,30),(56,'SuperSkunk 3g',1,30),(56,'Grinder MM',2,5),(56,'Cartine MM',1,3),
(57,'Mexican Strong Pre-roll',1,25),(57,'Accendino MM',1,2),
(58,'Mexican Strong Pre-roll',2,25),
(59,'Strong Cannabis Gummies MM',1,40),
(60,'Vape Disposable 2ml',1,100),
(61,'Mexican Strong Pre-roll',2,25),
(62,'Vape Disposable 2ml',1,100),
(63,'dry sift 10g',1,130),(63,'Cartine MM',1,3),
(64,'Bubble Hash 2g',1,30),
(65,'Box da 3 Pre-roll',1,30),(65,'Mexican Strong Pre-roll',1,25),
(66,'Strong Cannabis Gummies MM',1,40),
(67,'Cherry Pie 3g',1,30),(67,'Actitube filtri pack of 10 pcs',1,3),
(68,'Bubble Hash 2g',1,30),
(69,'dry sift 5g',1,65),
(70,'Mexican Strong Pre-roll',1,25),
(71,'Bubble Hash 2g',1,30),(71,'Runtz 2g',1,25),
(72,'Bubble Hash 5g',1,65),
(73,'Bubble Hash 2g',1,30),
(74,'dry sift 2g',1,30),(74,'Cartine MM',1,3),
(75,'Spaghetti Cheese 3g',1,30),(75,'Cartine MM',1,3),(75,'Grinder MM',1,5),
(76,'Clipper Accendino',1,3),
(77,'dry sift 2g',1,30),(77,'Spaghetti Cheese 2g',1,25),(77,'Mango 2g',1,25),(77,'Gelato 2g',1,25),(77,'Cartine MM',1,3),
(78,'Mango 2g',1,25),
(79,'Cartine MM',1,3),(79,'Actitube filtri pack of 10 pcs',2,3),
(80,'dry sift 10g',1,130),
(81,'Strong Cannabis Gummies MM',1,40),
(82,'Bubble Hash 2g',1,30),
(83,'Euphory-E (Happy Caps) DISPLAY',2,20),(83,'Lemon hash 2g',1,30),(83,'dry sift 2g',1,30),
(84,'Vape Disposable 2ml',1,100),
(85,'dry sift 5g',1,65),(85,'Cartine MM',1,3),
(86,'Bubble Hash 5g',1,65),(86,'Cartine MM',1,3),
(87,'Mexican Strong Pre-roll',1,25),
(88,'Mexican Strong Pre-roll',1,25),
(89,'SuperSkunk 3g',1,30),(89,'Cartine MM',1,3),
(90,'Runtz 2g',1,25),
(91,'dry sift 2g',1,30),
(92,'Vape Disposable 2ml',1,100),
(93,'Bubble Hash 2g',1,30),
(94,'Cartine MM',1,3),
(95,'Strong Cannabis Gummies MM',1,40),(95,'Euphory-E (Happy Caps) DISPLAY',1,20),
(96,'dry sift 5g',1,65),
(97,'Runtz 3g',1,30),(97,'Bob my Box',1,5),(97,'Grinder MM',1,5),
(98,'Mexican Strong Pre-roll',1,25),(98,'Accendino MM',1,2),
(99,'dry sift 5g',1,65),
(100,'Mexican Strong Pre-roll',1,25),
(101,'Bubble Hash 2g',1,30),
(102,'Bubble Hash 5g',1,65),
(103,'Vape Disposable 2ml',2,100),
(104,'Trance-E (Happy Caps) DISPLAY',2,20),
(105,'Lemon hash 2g',1,30),(105,'Grinder MM',1,5),
(106,'Bubble Hash 2g',1,30),
(107,'Lemon weed 3g',1,30),(107,'Bubble Hash 2g',1,30),(107,'cartine no logo',1,3),
(108,'Grinder Card',1,8),(108,'Mango 5g',1,50),(108,'Sour Diesel 5g',1,50),(108,'Amnesia 5g',1,50),(108,'Bubble Hash 2g',1,30),
(109,'Hemp Cones + Glass Tip',1,5),
(110,'Spaghetti Cheese 3g',1,30),
(111,'Mexican Strong Pre-roll',1,25),
(112,'Bubble Hash 2g',1,30),(112,'Euphory-E (Happy Caps) DISPLAY',1,20),
(113,'Cherry Pie 3g',1,30),(113,'Grinder MM',1,5),(113,'cartine no logo',1,3),
(114,'Amnesia 3g',1,30),(114,'Bob my Box',1,5),
(115,'Lemon weed 3g',1,30),
(116,'THC Shots',2,15),
(117,'dry sift 2g',1,30),
(118,'Bubble Hash 5g',1,65),
(119,'Mexican Strong Pre-roll',2,25),
(120,'Bubble Hash 2g',1,30),
(121,'Bubble Hash 2g',1,30),
(122,'Strong Cannabis Gummies MM',1,40),
(123,'Spaghetti Cheese 2g',1,25),
(124,'cartine no logo',1,3),(124,'dry sift 2g',1,30),
(125,'Mexican Strong Pre-roll',3,25),
(126,'Bubble Hash 2g',1,30),
(127,'dry sift 5g',1,65),
(128,'Accendino MM',1,2),(128,'Mexican Strong Pre-roll',1,25),
(129,'Bubble Hash 2g',1,30),
(130,'Bubble Hash 2g',1,30),
(131,'Spaghetti Cheese 3g',1,30),(131,'Mango 3g',1,30),(131,'Grinder MM',1,5),(131,'Grinder Card',1,8),(131,'Clipper Accendino',1,3),(131,'cartine no logo',1,3),
(132,'Mexican Strong Pre-roll',3,25),
(133,'Spaghetti Cheese 3g',1,30),
(134,'Mexican Strong Pre-roll',3,25),
(135,'Mexican Strong Pre-roll',1,25),
(136,'dry sift 5g',1,65),(136,'Cartine MM',1,3),(136,'Bubble Hash 5g',1,65),
(137,'Bubble Hash 10g',1,130),
(138,'cartine no logo',1,3);

-- STEP 3: Delete existing sales for High Street 6/1-6/5
DO $$
DECLARE v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;
  DELETE FROM sale_items WHERE sale_id IN (
    SELECT id FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
  );
  DELETE FROM sales WHERE store_id = v_store_id AND created_at >= '2026-06-01' AND created_at < '2026-06-05';
END $$;

-- STEP 4: Insert all sales and items
DO $$
DECLARE
  v_store_id uuid;
  v_sale_id uuid;
  v_user_id uuid;
  v_prod_id uuid;
  inv record;
  itm record;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE name ILIKE '%high street%' LIMIT 1;

  FOR inv IN SELECT * FROM tmp_inv ORDER BY n LOOP
    -- Map referente to user_id
    v_user_id := CASE inv.ref
      WHEN 'Peppe' THEN '7add32b7-4803-41d7-b6a8-6e7df62a617e'::uuid
      WHEN 'Andrea' THEN '3741ec04-5d49-4e8b-8eea-4ee71eb8e41e'::uuid
      WHEN 'Lorenzo' THEN 'c79bd98c-980f-4d8e-91e6-0bd246d8dbb8'::uuid
      WHEN 'Adam' THEN 'd18168bb-c296-47d1-b379-1db28f4a9f3e'::uuid
      ELSE '3741ec04-5d49-4e8b-8eea-4ee71eb8e41e'::uuid -- default Andrea
    END;

    -- Insert sale
    INSERT INTO sales (
      store_id, user_id, created_by, movement_type, payment_method, 
      total, subtotal, customer_name, acquisition_channel, 
      split_cash_amount, created_at
    ) VALUES (
      v_store_id, v_user_id, v_user_id, inv.mv::movement_type, inv.pay::payment_method,
      inv.total, inv.total, inv.cust, inv.ch::acquisition_channel,
      CASE WHEN inv.n = 8 THEN 20 WHEN inv.n = 22 THEN 20 ELSE NULL END,
      inv.ts
    ) RETURNING id INTO v_sale_id;

    -- Insert items for this invoice
    FOR itm IN SELECT * FROM tmp_items WHERE n = inv.n LOOP
      SELECT id INTO v_prod_id FROM products 
      WHERE LOWER(name) = LOWER(itm.pname) AND store_id = v_store_id LIMIT 1;
      
      INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total)
      VALUES (v_sale_id, v_prod_id, itm.pname, itm.qty, itm.price, itm.price * itm.qty);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Done! Inserted % sales', (SELECT count(*) FROM tmp_inv);
END $$;

-- STEP 5: Verify
SELECT created_at::date as data, count(*) as vendite, sum(total) as totale,
  sum(CASE WHEN payment_method='cash' THEN total ELSE 0 END) as cash,
  sum(CASE WHEN payment_method='pos' THEN total ELSE 0 END) as pos,
  sum(CASE WHEN movement_type='autoconsumo' THEN total ELSE 0 END) as autoconsumo
FROM sales 
WHERE store_id = (SELECT id FROM stores WHERE name ILIKE '%high street%' LIMIT 1)
  AND created_at >= '2026-06-01' AND created_at < '2026-06-05'
GROUP BY created_at::date ORDER BY data;

-- Cleanup
DROP TABLE IF EXISTS tmp_inv;
DROP TABLE IF EXISTS tmp_items;
