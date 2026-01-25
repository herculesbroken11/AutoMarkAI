// src/components/login-form.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Loader2, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginForm() {
  const { user, loginWithEmail, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("porters@admin.com");
  const [password, setPassword] = useState("12345678");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await loginWithEmail(email, password);
      // The useEffect will handle the redirect on user state change.
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      setIsLoggingIn(false);
    }
  };
  
  if (loading || user) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline font-bold">Porters AutoMarkAI</CardTitle>
          <CardDescription>Sign in to your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="porters@admin.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isLoggingIn}>
              {isLoggingIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
