import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function VoiceAgent() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setTranscript([]);
    },
    onDisconnect: () => {
      setIsConnecting(false);
    },
    onMessage: (message) => {
      if (message.type === "user_transcript") {
        const text = (message as any).user_transcription_event?.user_transcript;
        if (text) setTranscript((prev) => [...prev, `You: ${text}`]);
      } else if (message.type === "agent_response") {
        const text = (message as any).agent_response_event?.agent_response;
        if (text) setTranscript((prev) => [...prev, `Duncan: ${text}`]);
      }
    },
    onError: (err) => {
      console.error("Voice agent error:", err);
      setError("Connection error. Please try again.");
      setIsConnecting(false);
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (fnError || !data?.token) {
        throw new Error(fnError?.message || "Failed to get conversation token");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start voice:", err);
      if (err.name === "NotAllowedError") {
        setError("Microphone access is required for voice mode.");
      } else {
        setError(err.message || "Failed to connect. Please try again.");
      }
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Pulsing orb */}
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            "absolute rounded-full transition-all duration-700",
            isConnected && isSpeaking
              ? "h-28 w-28 bg-primary/20 animate-pulse"
              : isConnected
              ? "h-24 w-24 bg-primary/10"
              : "h-20 w-20 bg-muted/30"
          )}
        />
        <button
          onClick={isConnected ? stopConversation : startConversation}
          disabled={isConnecting}
          className={cn(
            "relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 shadow-lg",
            isConnected
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
            isConnecting && "opacity-60 cursor-not-allowed"
          )}
        >
          {isConnecting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isConnected ? (
            <PhoneOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isConnecting ? (
          "Connecting…"
        ) : isConnected ? (
          <>
            {isSpeaking ? (
              <>
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                Duncan is speaking
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 text-green-500" />
                Listening…
              </>
            )}
          </>
        ) : (
          "Tap to start voice conversation"
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
      )}

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div className="w-full max-w-md mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5">
          {transcript.map((line, i) => (
            <p
              key={i}
              className={cn(
                "text-xs",
                line.startsWith("Duncan:")
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              {line}
            </p>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
}
