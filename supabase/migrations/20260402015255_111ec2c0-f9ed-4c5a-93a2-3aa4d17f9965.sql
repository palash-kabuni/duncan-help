ALTER TABLE public.slack_notification_logs ADD COLUMN event_key TEXT;
CREATE INDEX idx_slack_event_key ON public.slack_notification_logs (event_key, created_at);