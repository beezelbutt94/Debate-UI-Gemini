-- Adds the Web Discovery feature's 'discovery' value to audit_reports.source_type.
--
-- Same pattern as 'competitors' before it: a new feature stores its report
-- in the shared audit_reports table, keyed by source_type, so the column's
-- check constraint has to widen to allow the new value.
alter table public.audit_reports drop constraint audit_reports_source_type_check;

alter table public.audit_reports
  add constraint audit_reports_source_type_check
  check (source_type in ('url', 'account', 'upload', 'competitors', 'discovery'));
