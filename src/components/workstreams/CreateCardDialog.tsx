import { useState } from "react";
import { Plus, CalendarDays, Tag, User, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCard, useUserProfiles, type CardStatus, type CardPriority } from "@/hooks/useWorkstreams";

export default function CreateCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createCard = useCreateCard();
  const { data: users } = useUserProfiles();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CardStatus>("amber");
  const [priority, setPriority] = useState<CardPriority>("medium");
  const [ownerId, setOwnerId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [projectTag, setProjectTag] = useState("");

  const reset = () => {
    setTitle(""); setDescription(""); setStatus("amber"); setPriority("medium");
    setOwnerId(""); setDueDate(""); setProjectTag("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await createCard.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      owner_id: ownerId || undefined,
      due_date: dueDate || undefined,
      project_tag: projectTag.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            New Workstream Card
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q2 Product Launch" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this workstream about?" className="min-h-[80px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1"><Flag className="h-3 w-3" /> Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as CardStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">🔴 Red</SelectItem>
                  <SelectItem value="amber">🟡 Amber</SelectItem>
                  <SelectItem value="green">🟢 Green</SelectItem>
                  <SelectItem value="done">✅ Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1"><Flag className="h-3 w-3" /> Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as CardPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1"><User className="h-3 w-3" /> Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {(users || []).map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.display_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Project / Workstream Tag</Label>
            <Input value={projectTag} onChange={e => setProjectTag(e.target.value)} placeholder="e.g. Product, Marketing, Ops" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createCard.isPending}>
            {createCard.isPending ? "Creating…" : "Create Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
