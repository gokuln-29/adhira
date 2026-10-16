-- A tax invoice can never be edited. Deleting is blocked too, except for the
-- schema owner's tooling (tests/retention purges) which sets @allow_invoice_delete = 1
-- in its own session; the application never does.
CREATE TRIGGER `invoices_no_update` BEFORE UPDATE ON `invoices`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued invoices are immutable';
END;
--> statement-breakpoint
CREATE TRIGGER `invoices_no_delete` BEFORE DELETE ON `invoices`
FOR EACH ROW
BEGIN
  IF COALESCE(@allow_invoice_delete, 0) <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued invoices cannot be deleted';
  END IF;
END;
