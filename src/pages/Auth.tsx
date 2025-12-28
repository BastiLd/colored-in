import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Loader2, Sparkles } from "lucide-react";

// List of known temporary/disposable email domains
const TEMP_EMAIL_DOMAINS = [
  "tempmail.com", "temp-mail.org", "guerrillamail.com", "guerrillamail.info",
  "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamailblock.com",
  "sharklasers.com", "grr.la", "guerrillamail.de", "10minutemail.com",
  "10minutemail.net", "10minutemail.org", "10minmail.com", "10minutesemail.net",
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com",
  "mailinater.com", "mailinator.info", "trashmail.com", "trashmail.net",
  "trashmail.org", "trashmail.me", "trashmail.ws", "trashemail.de",
  "throwawaymail.com", "throwaway.email", "throam.com", "yopmail.com",
  "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "fakeinbox.com", "fakeinbox.net", "fakeinbox.org", "fakeinbox.info",
  "dispostable.com", "disposableaddress.com", "disposable.email",
  "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "mailcatch.com", "dodgit.com", "dodgeit.com", "e4ward.com",
  "gishpuppy.com", "kasmail.com", "spamfree24.org", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamobox.com",
  "tempinbox.com", "tempinbox.co.uk", "mytrashmail.com", "mt2009.com",
  "thankyou2010.com", "trash2009.com", "mt2014.com", "mailmetrash.com",
  "trashymail.com", "trashymail.net", "tempmailaddress.com", "tempr.email",
  "discard.email", "discardmail.com", "discardmail.de", "spambog.com",
  "spambog.de", "spambog.ru", "emailondeck.com", "anonymbox.com",
  "33mail.com", "maildrop.cc", "getairmail.com", "mohmal.com",
  "tempail.com", "burnermail.io", "mailsac.com", "inboxkitten.com",
  "dropmail.me", "mintemail.com", "emailfake.com", "generator.email",
  "crazymailing.com", "mailnesia.com", "temp.email", "tempsky.com",
  "tempemailgen.com", "tempemailaddress.com", "emailtemporanea.com",
  "emailtemporanea.net", "emailtemporar.ro", "nowmymail.com",
  "1secmail.com", "1secmail.net", "1secmail.org", "kuku.lu",
  "guerilla.email", "getnada.com", "fakemail.net", "emkei.cz",
  "mailpoof.com", "tempmailo.com", "tempmailin.com", "tmails.net",
  "moakt.com", "incognitomail.org", "incognitomail.co", "incognitomail.com",
  "mytemp.email", "tmpmail.org", "tmpmail.net", "tempemail.net",
  "tempemail.com", "tempemail.co", "fastemail.us", "firemailbox.club",
  "randommail.net", "spambox.us", "tempinbox.xyz", "mailbox.in.ua",
  "emailondeck.io", "fakemailgenerator.com", "privy-mail.com",
  "guerrillamail.xyz", "emailsensei.com", "filzmail.com", "harakirimail.com",
  "hidemail.de", "mailfreeonline.com", "mailhazard.com", "mailhazard.us",
  "meltmail.com", "onewaymail.com", "safetymail.info", "wegwerfmail.de",
  "wegwerfmail.net", "wegwerfmail.org", "wegwerf-email.de", "wegwerf-email.at",
  "wegwerf-emails.de", "wegwerfadresse.de", "spamex.com", "spam4.me",
  "fakemailgenerator.net", "easytrashmail.com", "spamdecoy.net"
];

function isTemporaryEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  // Check exact match
  if (TEMP_EMAIL_DOMAINS.includes(domain)) return true;
  
  // Check for common patterns
  const suspiciousPatterns = [
    /temp.*mail/i, /mail.*temp/i, /disposable/i, /throwaway/i,
    /trash.*mail/i, /mail.*trash/i, /fake.*mail/i, /mail.*fake/i,
    /spam/i, /guerrilla/i, /10minute/i, /yopmail/i, /mailinator/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(domain));
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    // Check for temporary email on signup
    if (!isLogin && isTemporaryEmail(email)) {
      toast.error("Temporary/disposable email addresses are not allowed. Please use a real email address.");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please login instead.");
            setIsLogin(true);
          } else {
            throw error;
          }
        } else {
          toast.success("Account created! You can now use AI palette generation.");
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">AI Palette Generator</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin 
                ? "Sign in to use AI palette generation" 
                : "Sign up to get 1 free AI palette generation"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              disabled={isLoading}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
