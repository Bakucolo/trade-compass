import { Bell, CreditCard, Lock, Moon, Palette, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
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

      {/* Subscription */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Pro Plan</p>
              <p className="text-sm text-muted-foreground">$19.99/month • Renews Feb 15, 2024</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/20 text-primary">
              Active
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="sm">Manage Subscription</Button>
          <Button variant="ghost" size="sm">View Invoices</Button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="glow">Save Changes</Button>
      </div>
    </div>
  );
}
