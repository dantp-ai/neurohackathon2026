-- Track who created each label so the clinician's label-review view can show
-- whether it came from the patient's check-in or the clinician.
-- 'clinician' | 'patient' (nullable for pre-existing rows).
ALTER TABLE public.labels ADD COLUMN IF NOT EXISTS source TEXT;
