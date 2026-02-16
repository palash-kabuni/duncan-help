import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import welcome1 from "@/assets/welcome-1.jpg";
import welcome2 from "@/assets/welcome-2.jpg";
import welcome3 from "@/assets/welcome-3.jpg";

const images = [welcome1, welcome2, welcome3];

const quotes = [
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Why don't scientists trust atoms? Because they make up everything.", author: "Duncan 🐾" },
  { text: "I told my computer I needed a break, and it said 'No problem — I'll go to sleep.'", author: "Duncan 🐾" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

const WelcomeModal = () => {
  const [show, setShow] = useState(false);
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)]);
  const [image] = useState(() => images[Math.floor(Math.random() * images.length)]);

  useEffect(() => {
    const shown = sessionStorage.getItem("duncan_welcome_shown");
    if (!shown) {
      setShow(true);
      sessionStorage.setItem("duncan_welcome_shown", "1");
    }
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={() => setShow(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image */}
          <div className="relative h-56 overflow-hidden">
            <img
              src={image}
              alt="Welcome"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            <button
              onClick={() => setShow(false)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground hover:bg-background/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quote */}
          <div className="px-6 pb-6 pt-2">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Daily Inspiration
              </span>
            </div>
            <blockquote className="text-lg font-medium text-foreground leading-relaxed mb-3">
              "{quote.text}"
            </blockquote>
            <p className="text-sm text-muted-foreground">— {quote.author}</p>

            <button
              onClick={() => setShow(false)}
              className="mt-6 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-all"
            >
              Let's get to work
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeModal;
