import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BriefingType = "morning" | "evening";

interface CEOBriefingRow {
  id: string;
  briefing_date: string;
  briefing_type: BriefingType;
  trajectory: string | null;
  outcome_probability: number | null;
  execution_score: number | null;
  workstream_scores: any;
  payload: any;
  created_at: string;
}

export const useCEOBriefing = (type: BriefingType) => {
  const [briefing, setBriefing] = useState<CEOBriefingRow | null>(null);
  const [previous, setPrevious] = useState<CEOBriefingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ceo_briefings")
      .select("*")
      .eq("briefing_type", type)
      .order("briefing_date", { ascending: false })
      .limit(2);
    if (error) {
      console.error("Load briefings error:", error);
    } else {
      setBriefing((data?.[0] as CEOBriefingRow) ?? null);
      setPrevious((data?.[1] as CEOBriefingRow) ?? null);
    }
    setLoading(false);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ceo-briefing", {
        body: { briefing_type: type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Briefing generated");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate briefing");
    } finally {
      setGenerating(false);
    }
  }, [type, load]);

  return { briefing, previous, loading, generating, generate, reload: load };
};
