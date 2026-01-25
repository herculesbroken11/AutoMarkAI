
"use client";

import { useEffect, useState, useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import PageHeader from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Mail, MessageSquare, CloudSun, KeyRound, Cloud, Video, FolderCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
    getSmtpSettings, saveSmtpSettings, 
    getTwilioSettings, saveTwilioSettings,
    getWeatherSettings, saveWeatherSettings,
    getGoogleDriveSettings, saveGoogleDriveSettings,
    getCloudinarySettings, saveCloudinarySettings,
    setupGoogleDriveFolders
} from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {children}
        </Button>
    );
}

function GoogleDriveCard({ initialSettings }: { initialSettings: any }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveGoogleDriveSettings, { success: false, message: null });
    const [isSettingUp, startSetupTransition] = useTransition();

    useEffect(() => {
        if (state.message) {
            toast({
                title: state.success ? "Success!" : "Error",
                description: state.message,
                variant: state.success ? "default" : "destructive",
            });
        }
    }, [state, toast]);

    const handleSetupFolders = () => {
        startSetupTransition(async () => {
            const result = await setupGoogleDriveFolders();
            toast({
                title: result.success ? "Success!" : "Error",
                description: result.message,
                variant: result.success ? "default" : "destructive",
            });
        });
    }

    return (
        <form action={formAction}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Google API Credentials</CardTitle>
              <CardDescription>
                For server-side access to Google Drive for cron jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Google Client ID</Label>
                <Input id="clientId" name="clientId" placeholder="Your Google Cloud project client ID" defaultValue={initialSettings?.clientId || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Google Client Secret</Label>
                <Input id="clientSecret" name="clientSecret" type="password" placeholder="••••••••••••" defaultValue={initialSettings?.clientSecret || ''} required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="refreshToken">Google Refresh Token</Label>
                <Input id="refreshToken" name="refreshToken" type="password" placeholder="••••••••••••" defaultValue={initialSettings?.refreshToken || ''} required />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
                <SubmitButton>Save Google API</SubmitButton>
                 <Button type="button" variant="outline" onClick={handleSetupFolders} disabled={isSettingUp}>
                    {isSettingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderCog className="mr-2 h-4 w-4" />}
                    Setup Drive Folders
                </Button>
            </CardFooter>
          </Card>
        </form>
    );
}

export default function SettingsPage() {
  const { toast } = useToast();
  
  const [smtpState, smtpFormAction] = useActionState(saveSmtpSettings, { success: false, message: null });
  const [initialSmtpSettings, setInitialSmtpSettings] = useState<any>(null);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [encryption, setEncryption] = useState('none');

  const [twilioState, twilioFormAction] = useActionState(saveTwilioSettings, { success: false, message: null });
  const [initialTwilioSettings, setInitialTwilioSettings] = useState<any>(null);
  const [twilioLoading, setTwilioLoading] = useState(true);
  
  const [weatherState, weatherFormAction] = useActionState(saveWeatherSettings, { success: false, message: null });
  const [initialWeatherSettings, setInitialWeatherSettings] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [initialGoogleDriveSettings, setInitialGoogleDriveSettings] = useState<any>(null);
  const [googleDriveLoading, setGoogleDriveLoading] = useState(true);

  const [cloudinaryState, cloudinaryFormAction] = useActionState(saveCloudinarySettings, { success: false, message: null });
  const [initialCloudinarySettings, setInitialCloudinarySettings] = useState<any>(null);
  const [cloudinaryLoading, setCloudinaryLoading] = useState(true);

  useEffect(() => {
    async function fetchAllSettings() {
      setSmtpLoading(true);
      setTwilioLoading(true);
      setWeatherLoading(true);
      setGoogleDriveLoading(true);
      setCloudinaryLoading(true);
      
      const [smtpRes, twilioRes, weatherRes, googleDriveRes, cloudinaryRes] = await Promise.all([
        getSmtpSettings(),
        getTwilioSettings(),
        getWeatherSettings(),
        getGoogleDriveSettings(),
        getCloudinarySettings(),
      ]);

      if (smtpRes.settings) {
        setInitialSmtpSettings(smtpRes.settings);
        setEncryption(smtpRes.settings.encryption || 'none');
      }
      setSmtpLoading(false);

      if (twilioRes.settings) {
        setInitialTwilioSettings(twilioRes.settings);
      }
      setTwilioLoading(false);
      
      if (weatherRes.settings) {
        setInitialWeatherSettings(weatherRes.settings);
      }
      setWeatherLoading(false);
      
       if (googleDriveRes.settings) {
        setInitialGoogleDriveSettings(googleDriveRes.settings);
      }
      setGoogleDriveLoading(false);

      if (cloudinaryRes.settings) {
        setInitialCloudinarySettings(cloudinaryRes.settings);
      }
      setCloudinaryLoading(false);
    }
    fetchAllSettings();
  }, []);

  const useToastEffect = (state: any) => {
    useEffect(() => {
        if (state.message) {
            toast({
                title: state.success ? "Success!" : "Error",
                description: state.message,
                variant: state.success ? "default" : "destructive",
            });
        }
    }, [state, toast]);
  };

  useToastEffect(smtpState);
  useToastEffect(twilioState);
  useToastEffect(weatherState);
  useToastEffect(cloudinaryState);

  const loading = smtpLoading || twilioLoading || weatherLoading || googleDriveLoading || cloudinaryLoading;

  if (loading) {
    return (
        <div className="space-y-8">
            <PageHeader
                title="Settings"
                description="Manage your application's configuration."
            />
            <div className="grid gap-8 md:grid-cols-2">
                {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-10 w-3/4" /></CardHeader>
                        <CardContent className="space-y-4">
                            {[...Array(2)].map((_, j) => <Skeleton key={j} className="h-10 w-full" />)}
                        </CardContent>
                        <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your application's notification channels and integrations."
      />
      
      <div className="grid gap-8 md:grid-cols-2">
        <form action={smtpFormAction}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Email (SMTP)</CardTitle>
              <CardDescription>
                Service used to send automated emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host</Label>
                <Input id="host" name="host" placeholder="smtp.example.com" defaultValue={initialSmtpSettings?.host || ''} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input id="port" name="port" type="number" placeholder="465" defaultValue={initialSmtpSettings?.port || ''} required />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="encryption">Encryption</Label>
                      <Select name="encryption" value={encryption} onValueChange={setEncryption}>
                          <SelectTrigger id="encryption"><SelectValue placeholder="Select encryption type" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="ssl">SSL</SelectItem>
                              <SelectItem value="tls">TLS</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="from">"From" Email</Label>
                      <Input id="from" name="from" type="email" placeholder="noreply@yourdomain.com" defaultValue={initialSmtpSettings?.from || ''} required />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="senderName">Sender Name</Label>
                      <Input id="senderName" name="senderName" placeholder="Your Company" defaultValue={initialSmtpSettings?.senderName || ''} required />
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">SMTP User</Label>
                <Input id="user" name="user" placeholder="your_username" defaultValue={initialSmtpSettings?.user || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">SMTP Password</Label>
                <Input id="pass" name="pass" type="password" placeholder="••••••••••••" defaultValue={initialSmtpSettings?.pass || ''} required />
              </div>
            </CardContent>
            <CardFooter>
                <SubmitButton>Save SMTP</SubmitButton>
            </CardFooter>
          </Card>
        </form>

        <form action={twilioFormAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>SMS (Twilio)</CardTitle>
                    <CardDescription>
                        Service for sending automated text messages.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="accountSid">Account SID</Label>
                        <Input id="accountSid" name="accountSid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" defaultValue={initialTwilioSettings?.accountSid || ''} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="authToken">Auth Token</Label>
                        <Input id="authToken" name="authToken" type="password" placeholder="••••••••••••" defaultValue={initialTwilioSettings?.authToken || ''} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fromNumber">Twilio Phone Number</Label>
                        <Input id="fromNumber" name="fromNumber" placeholder="+15017122661" defaultValue={initialTwilioSettings?.fromNumber || ''} required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton>Save Twilio</SubmitButton>
                </CardFooter>
            </Card>
        </form>

        <form action={weatherFormAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CloudSun className="h-5 w-5"/>Weather (OpenWeatherMap)</CardTitle>
                    <CardDescription>
                        API key for fetching weather data to enable smart notifications.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input id="apiKey" name="apiKey" type="password" placeholder="••••••••••••" defaultValue={initialWeatherSettings?.apiKey || ''} required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton>Save Weather Key</SubmitButton>
                </CardFooter>
            </Card>
        </form>
        
        <GoogleDriveCard initialSettings={initialGoogleDriveSettings} />

        <form action={cloudinaryFormAction}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" />Cloudinary Credentials</CardTitle>
              <CardDescription>
                For cloud-based video processing and transformations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cloud_name">Cloud Name</Label>
                <Input id="cloud_name" name="cloud_name" placeholder="your_cloud_name" defaultValue={initialCloudinarySettings?.cloud_name || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input id="api_key" name="api_key" placeholder="your_api_key" defaultValue={initialCloudinarySettings?.api_key || ''} required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="api_secret">API Secret</Label>
                <Input id="api_secret" name="api_secret" type="password" placeholder="••••••••••••" defaultValue={initialCloudinarySettings?.api_secret || ''} required />
              </div>
            </CardContent>
            <CardFooter>
                <SubmitButton>Save Cloudinary</SubmitButton>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
