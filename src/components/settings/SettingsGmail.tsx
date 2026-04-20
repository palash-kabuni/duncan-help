import { Mail, Loader2, Sparkles, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  useGmailWritingProfile,
  useGmailTrainStyle,
  useGmailDeleteWritingProfile,
  useGmailStatus,
} from "@/hooks/useGmailIntegration";
import { formatDistanceToNow } from "date-fns";

export default function SettingsGmail() {
  const { data: status } = useGmailStatus();
  const { data: profile, isLoading } = useGmailWritingProfile();
  const trainMutation = useGmailTrainStyle();
  const deleteMutation = useGmailDeleteWritingProfile();

  const trained = profile?.last_trained_at;

  if (!status?.connected) {
    return (
      <div className="px-6 py-8">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Gmail not connected</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Connect your Gmail from the Integrations page to enable Duncan's writing-style learning.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Writing-style training
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          Duncan analyses your last 300 sent emails to learn your tone, vocabulary, and structure —
          so drafts sound like you. Content is processed once, redacted of personal details, and only the
          derived style profile is stored.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading profile...
          </div>
        ) : trained ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-norman-success" />
              <span className="text-xs font-medium text-foreground">Profile active</span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <div>Trained on {profile?.sample_count ?? 0} emails</div>
              <div>Last updated {formatDistanceToNow(new Date(trained), { addSuffix: true })}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No profile yet. Run training to teach Duncan how you write.
          </div>
        )}
      </div>

      {/* Sample preview */}
      {profile?.style_summary && (
        <details className="rounded-xl border border-border bg-card/50 p-4 group">
          <summary className="text-xs font-medium text-foreground cursor-pointer list-none flex items-center justify-between">
            <span>View learned style summary</span>
            <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">
            {profile.style_summary}
          </p>
        </details>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => trainMutation.mutate(300)}
          disabled={trainMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {trainMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Training... (~2 min)
            </>
          ) : (
            <>
              {trained ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {trained ? "Re-train Duncan" : "Train Duncan on my writing"}
            </>
          )}
        </button>

        {trained && (
          <button
            onClick={() => {
              if (confirm("Delete your writing profile? Duncan will fall back to generic email rules.")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-border text-muted-foreground px-4 py-2 text-xs font-medium hover:text-destructive hover:border-destructive/50 transition-all disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete profile
          </button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Privacy: Email content is sent to OpenAI for one-time analysis only. Personal details (emails,
        phone numbers) are redacted before processing. Only the derived style profile is stored.
      </p>
    </div>
  );
}
