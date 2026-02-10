import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tastytradeAuthService } from '@/services/tastytradeAuth';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectTastytradeDialogProps {
    onConnect: () => void;
    trigger?: React.ReactNode;
}

export function ConnectTastytradeDialog({ onConnect, trigger }: ConnectTastytradeDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSandbox, setIsSandbox] = useState(false); // Default to Live as per user request
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await tastytradeAuthService.login(username, password, isSandbox);

            if (result.success) {
                toast.success('Successfully connected to Tastytrade');
                setIsOpen(false);
                onConnect();
            } else {
                setError(result.error || 'Login failed');
                toast.error('Failed to connect to Tastytrade');
            }
        } catch (err) {
            setError('An unexpected error occurred');
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Connect Tastytrade</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Connect to Tastytrade</DialogTitle>
                    <DialogDescription>
                        Enter your Tastytrade credentials to enable real-time market data and portfolio integration.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                    {error && (
                        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="username">Username/Email</Label>
                        <Input
                            id="username"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="sandbox"
                            checked={isSandbox}
                            onChange={(e) => setIsSandbox(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <Label htmlFor="sandbox" className="cursor-pointer">Use Sandbox Environment</Label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
