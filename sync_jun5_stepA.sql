-- SYNC VENDITE 5 GIUGNO - Step A: Crea tabelle
DROP TABLE IF EXISTS tmp_items;
DROP TABLE IF EXISTS tmp_inv;
CREATE TABLE tmp_inv (n int, ts timestamptz, pay text, total numeric, ref text, cust text, ch text, mv text);
CREATE TABLE tmp_items (n int, pname text, qty int, price numeric);
