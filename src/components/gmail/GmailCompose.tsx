import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGmailSendEmail } from "@/hooks/useGmailIntegration";

interface GmailComposeProps {
  onSent?: () => void;
}

const GmailCompose = ({ onSent }: GmailComposeProps) => {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);

  const sendMutation = useGmailSendEmail();

  const handleSend = () => {
    if (!to.trim()) return;
    if (!subject.trim()) return;
    if (!body.trim()) return;

    sendMutation.mutate(
      { to, cc: cc || undefined, bcc: bcc || undefined, subject, body },
      {
        onSuccess: () => {
          setTo("");
          setCc("");
          setBcc("");
          setSubject("");
          setBody("");
          onSent?.();
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">New Message</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="h-9 bg-secondary/30 border-border text-sm"
          />
        </div>

        <button
          onClick={() => setShowCcBcc(!showCcBcc)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCcBcc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Cc / Bcc
        </button>

        {showCcBcc && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cc</Label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="h-9 bg-secondary/30 border-border text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bcc</Label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="h-9 bg-secondary/30 border-border text-sm"
              />
            </div>
          </motion.div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="h-9 bg-secondary/30 border-border text-sm"
          />
        </div>

        <div className="space-y-1.5 flex-1">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="min-h-[200px] bg-secondary/30 border-border text-sm resize-none"
          />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border">
        <button
          onClick={handleSend}
          disabled={sendMutation.isPending || !to.trim() || !subject.trim() || !body.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sendMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default GmailCompose;
