alter table attachments add column if not exists receipt_number text;
alter table attachments add column if not exists voucher_number text;
create indexes if not exists on (receipt_number, voucher_number);
add constraint attachments_one_parent_chk check (not (receipt_number is not null and voucher_number is not null));
