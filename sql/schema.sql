-- Updated schema.sql to add receipt_number and voucher_number columns

ALTER TABLE attachments
ADD COLUMN receipt_number VARCHAR(255),
ADD COLUMN voucher_number VARCHAR(255);