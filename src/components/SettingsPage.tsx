import { useState, useEffect } from 'react';
import { Bell, CreditCard, Lock, Moon, Palette, User, Sparkles, Key, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';

export function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [hasGemini, setHasGemini] = useState(false);
  const [hasOpenrouter, setHasOpenrouter] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch configured key status
  useEffect(() => {
    fetch('/api/settings/keys')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasGeminiApiKey) setHasGemini(true);
        if (data.hasOpenrouterApiKey) setHasOpenrouter(true);
      })
      .catch((e) => console.warn('Failed to load key settings', e));
  }, []);

  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKeys(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: geminiApiKey.trim() || undefined,
          openrouterApiKey: openrouterApiKey.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        if (geminiApiKey.trim()) setHasGemini(true);
        if (openrouterApiKey.trim()) setHasOpenrouter(true);
        setGeminiApiKey('');
        setOpenrouterApiKey('');
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert('Failed to save API keys');
      }
    } catch (err: any) {
      alert(`Error saving keys: ${err.message}`);
    } finally {
      setIsSavingKeys(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account, API integrations, and preferences</p>
      </div>

      {/* AI & Research Intelligence Providers */}
      <div className="glass-card rounded-xl p-6 border border-purple-500/20 bg-purple-950/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI & Research Engine Keys</h2>
              <p className="text-xs text-muted-foreground">Configure Google AI Studio (Gemini) or OpenRouter to power autonomous research reports</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveApiKeys} className="space-y-4">
          {/* Google AI Studio (Gemini) */}
          <div className="p-4 rounded-xl bg-card/60 border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-primary" /> Google AI Studio API Key (Gemini Free Tier)
              </label>
              {hasGemini ? (
                <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                  <Check className="w-3 h-3 mr-1" /> Configured & Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                  Not Configured
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Get your free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com</a>. Powers `gemini-2.5-flash` with zero cost.
            </p>
            <div className="relative">
              <Input
                type={showGeminiKey ? 'text' : 'password'}
                placeholder={hasGemini ? '•••••••••••••••••••••••••••••••• (Paste new key to update)' : 'AIzaSy... (Paste your Google AI Studio key)'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="pr-10 font-mono text-xs bg-background/80"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OpenRouter Fallback */}
          <div className="p-4 rounded-xl bg-card/60 border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-muted-foreground" /> OpenRouter API Key (Optional Fallback)
              </label>
              {hasOpenrouter ? (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                  <Check className="w-3 h-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border text-[10px]">
                  Optional
                </Badge>
              )}
            </div>
            <div className="relative">
              <Input
                type={showOpenrouterKey ? 'text' : 'password'}
                placeholder={hasOpenrouter ? '•••••••••••••••••••••••••••••••• (Paste new key to update)' : 'sk-or-v1-...'}
                value={openrouterApiKey}
                onChange={(e) => setOpenrouterApiKey(e.target.value)}
                className="pr-10 font-mono text-xs bg-background/80"
              />
              <button
                type="button"
                onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOpenrouterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {saveSuccess ? (
              <span className="text-xs text-success flex items-center gap-1 font-medium">
                <Check className="w-4 h-4" /> API keys saved to environment successfully!
              </span>
            ) : <span />}

            <Button
              type="submit"
              variant="glow"
              size="sm"
              disabled={isSavingKeys || (!geminiApiKey.trim() && !openrouterApiKey.trim())}
              className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5"
            >
              {isSavingKeys ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save API Keys
            </Button>
          </div>
        </form>
      </div>

      {/* Profile Section */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <span className="text-xl font-bold text-foreground">JD</span>
          </div>
          <div>
            <Button variant="outline" size="sm">Change Avatar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="data-label mb-2 block">First Name</label>
            <Input defaultValue="John" className="bg-accent border-border" />
          </div>
          <div>
            <label className="data-label mb-2 block">Last Name</label>
            <Input defaultValue="Doe" className="bg-accent border-border" />
          </div>
          <div className="sm:col-span-2">
            <label className="data-label mb-2 block">Email</label>
            <Input defaultValue="john.doe@example.com" className="bg-accent border-border" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Price Alerts</p>
              <p className="text-sm text-muted-foreground">Get notified when stocks hit your target prices</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Trade Confirmations</p>
              <p className="text-sm text-muted-foreground">Receive notifications for executed trades</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Market News</p>
              <p className="text-sm text-muted-foreground">Daily market updates and news</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Weekly Summary</p>
              <p className="text-sm text-muted-foreground">Weekly portfolio performance report</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Use dark theme (currently active)</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Security</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">Enable</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Change Password</p>
              <p className="text-sm text-muted-foreground">Update your account password</p>
            </div>
            <Button variant="outline" size="sm">Update</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
