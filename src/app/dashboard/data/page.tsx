// This is a comment added to the top of the data page.
"use client";

import { useMemo, useState, useTransition } from "react";
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { galleryFirestore } from "@/firebase/config"; 
import PageHeader from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, Clock, XCircle, Briefcase, Calendar as CalendarIcon, Bot, Loader2, Trash2, Send } from "lucide-react";
import { format, fromUnixTime } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const NotificationCard = ({ notification, onDelete }: { notification: any; onDelete: (id: string) => void }) => {
    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'sent':
                return { icon: <CheckCircle className="h-5 w-5 text-green-500" />, text: "Sent", color: "bg-green-100 text-green-800" };
            case 'pending':
                return { icon: <Clock className="h-5 w-5 text-yellow-500" />, text: "Pending", color: "bg-yellow-100 text-yellow-800" };
            case 'failed':
                return { icon: <XCircle className="h-5 w-5 text-red-500" />, text: "Failed", color: "bg-red-100 text-red-800" };
            default:
                return { icon: <Bell className="h-5 w-5 text-gray-500" />, text: "Unknown", color: "bg-gray-100 text-gray-800" };
        }
    };

    const statusInfo = getStatusInfo(notification.status);
    const notificationDate = notification.createdAt ? format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a") : "No date";

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-4">
                <div className={`p-3 rounded-full flex-shrink-0 ${statusInfo.color}`}>
                    {statusInfo.icon}
                </div>
                <div className="flex-grow space-y-2">
                    <p className="font-medium leading-snug">{notification.message}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>To: <strong>{notification.customerEmail}</strong></span>
                        <span className="capitalize">Trigger: <strong>{notification.triggerType?.replace(/_/g, ' ')}</strong></span>
                        <span>{notificationDate}</span>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusInfo.color}>{statusInfo.text}</Badge>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this notification.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(notification.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
};

const ServiceCard = ({ service }: { service: any }) => {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-4">
                <div className="p-3 rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
                    <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex-grow space-y-1">
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{service.shortDescription}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>Price: <strong>${service.price}</strong></span>
                        <span>Duration: <strong>{service.duration} min</strong></span>
                    </div>
                </div>
                 {service.category && <Badge variant="outline">{service.category}</Badge>}
            </CardContent>
        </Card>
    );
};

const BookingCard = ({ booking }: { booking: any }) => {
    const bookingDate = booking.bookingDate?.seconds 
        ? format(fromUnixTime(booking.bookingDate.seconds), "MMM d, yyyy 'at' h:mm a") 
        : "No date";

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-4">
                <div className="p-3 rounded-full bg-purple-100 text-purple-800 flex-shrink-0">
                    <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="flex-grow space-y-1">
                    <p className="font-semibold">{booking.serviceName}</p>
                    <p className="text-sm text-muted-foreground">For: {booking.customerName} ({booking.customerEmail})</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>On: <strong>{bookingDate}</strong></span>
                        <span>Vehicle: <strong>{booking.vehicleInfo?.make} {booking.vehicleInfo?.model}</strong></span>
                    </div>
                </div>
                {booking.status && <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>}
            </CardContent>
        </Card>
    );
};

const DataList = ({ items, loading, type, emptyMessage, emptyIcon: EmptyIcon, onDelete }: { items: any[], loading: boolean, type: 'notification' | 'service' | 'booking', emptyMessage: string, emptyIcon: React.ElementType, onDelete?: (id: string) => void }) => {
    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4 flex items-start gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-grow space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                <EmptyIcon className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">{emptyMessage.split('.')[0]}</h3>
                <p className="mt-1 text-sm">{emptyMessage.split('.')[1]}</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {items.map(item => {
                switch(type) {
                    case 'notification': return <NotificationCard key={item.id} notification={item} onDelete={onDelete!} />;
                    case 'service': return <ServiceCard key={item.id} service={item} />;
                    case 'booking': return <BookingCard key={item.id} booking={item} />;
                    default: return null;
                }
            })}
        </div>
    )
}

export default function DataPage() {
    const { toast } = useToast();
    const [isGenerating, startGeneratingTransition] = useTransition();
    const [isSending, startSendingTransition] = useTransition();
    const [isDeleting, startDeletingTransition] = useTransition();

    const notificationsQuery = useMemo(() => query(
        collection(galleryFirestore, 'enginenotifications'),
        orderBy('createdAt', 'desc')
    ), []);
    const [notificationsCollection, notificationsLoading, notificationsError] = useCollection(notificationsQuery);
    const notifications = useMemo(() => notificationsCollection?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [], [notificationsCollection]);

    const servicesQuery = useMemo(() => query(
        collection(galleryFirestore, 'services'),
        orderBy('createdAt', 'desc')
    ), []);
    const [servicesCollection, servicesLoading, servicesError] = useCollection(servicesQuery);
    const services = useMemo(() => servicesCollection?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [], [servicesCollection]);
    
    const bookingsQuery = useMemo(() => query(
        collection(galleryFirestore, 'bookings'),
        orderBy('createdAt', 'desc')
    ), []);
    const [bookingsCollection, bookingsLoading, bookingsError] = useCollection(bookingsQuery);
    const bookings = useMemo(() => bookingsCollection?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [], [bookingsCollection]);

    const error = notificationsError || servicesError || bookingsError;
    const pendingNotificationsCount = useMemo(() => notifications.filter(n => n.status === 'pending').length, [notifications]);


    const handleGenerateNotifications = () => {
        startGeneratingTransition(async () => {
            try {
                const response = await fetch('/api/cron/generate-notifications', {
                    method: 'POST',
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Failed to generate notifications.");
                }

                toast({
                    title: "Generation Started",
                    description: result.message || "The AI is now generating notifications.",
                });

            } catch (error: any) {
                toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive",
                });
            }
        });
    }

    const handleSendNotifications = () => {
        startSendingTransition(async () => {
            try {
                const response = await fetch('/api/cron/send-notifications', {
                    method: 'POST',
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Failed to send notifications.");
                }
                toast({
                    title: "Notifications Sent!",
                    description: result.message || "Pending notifications have been sent.",
                });
            } catch (error: any) {
                 toast({
                    title: "Error Sending",
                    description: error.message,
                    variant: "destructive",
                });
            }
        });
    };

    const handleDeleteNotification = (id: string) => {
        startDeletingTransition(async () => {
            try {
                const notificationRef = doc(galleryFirestore, 'enginenotifications', id);
                await deleteDoc(notificationRef);
                toast({
                    title: "Notification Deleted",
                    description: "The notification has been successfully removed.",
                });
            } catch (error: any) {
                 toast({
                    title: "Error Deleting",
                    description: error.message || "Could not delete the notification.",
                    variant: "destructive",
                });
            }
        });
    }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Data Viewer"
        description="View your core business data like notifications, services, and bookings."
      >
        <Button onClick={handleGenerateNotifications} disabled={isGenerating || isSending}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            Generate Notifications
        </Button>
         <Button onClick={handleSendNotifications} disabled={isSending || isGenerating || pendingNotificationsCount === 0}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Pending ({pendingNotificationsCount})
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Data Collections</CardTitle>
          <CardDescription>
            This is a read-only view of your most important Firestore collections from the porteradmin project.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {error && <p className="text-red-500">Error: {error.message}</p>}
            <Tabs defaultValue="notifications" className="w-full">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                    <TabsTrigger value="notifications">Notifications ({notifications.length})</TabsTrigger>
                    <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
                    <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="notifications" className="mt-6">
                    <DataList 
                        items={notifications} 
                        loading={notificationsLoading || isDeleting}
                        type="notification"
                        emptyMessage="No Notifications Found. Generated notifications will appear here."
                        emptyIcon={Bell}
                        onDelete={handleDeleteNotification}
                    />
                </TabsContent>
                <TabsContent value="services" className="mt-6">
                    <DataList 
                        items={services} 
                        loading={servicesLoading}
                        type="service"
                        emptyMessage="No Services Found. Add services in your system to see them here."
                        emptyIcon={Briefcase}
                    />
                </TabsContent>
                <TabsContent value="bookings" className="mt-6">
                     <DataList 
                        items={bookings} 
                        loading={bookingsLoading}
                        type="booking"
                        emptyMessage="No Bookings Found. New bookings will appear here as they are created."
                        emptyIcon={CalendarIcon}
                    />
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
