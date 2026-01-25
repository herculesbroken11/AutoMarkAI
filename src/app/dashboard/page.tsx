// This is the main dashboard page that displays business analytics and Google Drive files.
"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { galleryFirestore } from "@/firebase/config";
import { collection, getDocs, Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import FileIcon from "@/components/file-icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  FileWarning,
  FolderSearch,
  Home,
  ChevronRight,
  Loader2,
  Folder as FolderIcon,
  DollarSign,
  Users,
  Megaphone,
  Briefcase,
  BarChart3,
  PieChart as PieChartIcon,
  Film,
  CalendarClock,
  Send,
  XCircle,
  ArrowUp,
  ArrowDownRight,
  Clock,
  RefreshCw,
  FolderPlus,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/page-header";
import { AreaChart, Area, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

// --- DASHBOARD DATA TYPES ---

interface DashboardStats {
  totalRevenue: number;
  totalServices: number;
  totalCustomers: number;
  totalContent: number;
  reelsGenerated: number;
  postedContent: number;
  scheduledContent: number;
  rejectedContent: number;
  weeklyRevenueChange: number;
  weeklyCustomerChange: number;
}

interface RecentBooking {
    id: string;
    customerName: string;
    serviceName: string;
    totalAmount: number;
    bookingDate: string;
    status: string;
}

// --- STATS CARD COMPONENT ---

const StatCard = ({
  title,
  value,
  icon,
  bgColor,
  change,
  changeType = 'increase'
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  change: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
}) => {
  return (
    <div className={`${bgColor} relative text-white rounded-lg shadow-lg w-full overflow-hidden`}>
      <div className="p-4">
        <div className="absolute right-[-5px] top-[15px] text-black opacity-10 text-5xl">
          {icon}
        </div>
        <h5 className="text-sm font-semibold mb-2">{title}</h5>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">
            {value}
          </h2>
          {change && (
            <span className={`text-xs ${changeType === 'increase' ? 'text-green-300' : 'text-red-300'} inline-flex items-center gap-1`}>
                {change}
                {changeType === 'increase' ? <ArrowUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENT ---

const AutoMarkDashboard = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [salesData, setSalesData] = useState<any[]>([]);
    const [serviceData, setServiceData] = useState<any[]>([]);
    const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);

     useEffect(() => {
        setLastUpdatedTime(new Date().toLocaleTimeString());
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const now = new Date();
                const sevenDaysAgo = new Date(new Date().setDate(now.getDate() - 7));
                const fourteenDaysAgo = new Date(new Date().setDate(now.getDate() - 14));

                // Fetch all bookings, posts, and services
                const bookingsSnapshot = await getDocs(collection(galleryFirestore, 'bookings'));
                const postsSnapshot = await getDocs(collection(galleryFirestore, 'posts'));
                const servicesSnapshot = await getDocs(collection(galleryFirestore, 'services'));

                const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const recentBookingsData = bookings.filter(b => (b.createdAt as Timestamp)?.toDate() > sevenDaysAgo);
                const previousWeekBookingsData = bookings.filter(b => {
                    const d = (b.createdAt as Timestamp)?.toDate();
                    return d > fourteenDaysAgo && d <= sevenDaysAgo;
                });

                // Calculate stats
                const totalRevenue = bookings.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
                const uniqueCustomers = new Set(bookings.map(b => b.customerEmail));

                const recentRevenue = recentBookingsData.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
                const previousRevenue = previousWeekBookingsData.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

                const recentCustomers = new Set(recentBookingsData.map(b => b.customerEmail)).size;
                const previousCustomers = new Set(previousWeekBookingsData.map(b => b.customerEmail)).size;
                
                const calculateChange = (current: number, previous: number) => {
                    if (previous === 0) return current > 0 ? 100 : 0;
                    return ((current - previous) / previous) * 100;
                }

                // Content Stats
                const totalContent = posts.length;
                const reelsGenerated = posts.filter(p => !!p.videoUrl).length;
                const postedContent = posts.filter(p => p.status === 'posted').length;
                const scheduledContent = posts.filter(p => p.status === 'scheduled').length;
                const rejectedContent = posts.filter(p => p.status === 'rejected').length;


                // Prepare chart data
                const salesByDay: { [key: string]: number } = {};
                const servicesCount: { [key: string]: number } = {};
                 for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = format(d, "MMM d");
                    salesByDay[key] = 0;
                }


                bookings.forEach(booking => {
                    if (booking.bookingDate?.seconds) {
                        const date = format(new Date(booking.bookingDate.seconds * 1000), "MMM d");
                         if(salesByDay[date] !== undefined){
                            salesByDay[date] = (salesByDay[date] || 0) + (booking.totalAmount || 0);
                        }
                    }
                    if (booking.serviceName) {
                        servicesCount[booking.serviceName] = (servicesCount[booking.serviceName] || 0) + 1;
                    }
                });

                const formattedSalesData = Object.entries(salesByDay).map(([name, sales]) => ({ name, sales })).slice(-7);
                const formattedServiceData = Object.entries(servicesCount).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);

                // Recent Bookings Table
                const sortedBookings = bookings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                const recentBookingsTable = sortedBookings.slice(0, 5).map(b => ({
                    id: b.id,
                    customerName: b.customerName,
                    serviceName: b.serviceName,
                    totalAmount: b.totalAmount,
                    bookingDate: b.bookingDate?.seconds ? format(new Date(b.bookingDate.seconds * 1000), "PPp") : 'N/A',
                    status: b.status
                }));

                setStats({
                    totalRevenue,
                    totalServices: servicesSnapshot.size,
                    totalCustomers: uniqueCustomers.size,
                    totalContent,
                    reelsGenerated,
                    postedContent,
                    scheduledContent,
                    rejectedContent,
                    weeklyRevenueChange: calculateChange(recentRevenue, previousRevenue),
                    weeklyCustomerChange: calculateChange(recentCustomers, previousCustomers),
                });
                setSalesData(formattedSalesData);
                setServiceData(formattedServiceData);
                setRecentBookings(recentBookingsTable);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    if (!stats) return <p>Could not load dashboard data.</p>;

    return (
         <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
                     <p className="text-sm text-muted-foreground mt-1">
                        Comprehensive insights into your platform performance
                    </p>
                </div>
                {lastUpdatedTime && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Last updated: {lastUpdatedTime}</span>
                    </div>
                )}
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign />} bgColor="l-bg-green-dark" change={`${stats.weeklyRevenueChange.toFixed(1)}%`} changeType={stats.weeklyRevenueChange >= 0 ? 'increase' : 'decrease'} />
                <StatCard title="Total Customers" value={stats.totalCustomers.toLocaleString()} icon={<Users />} bgColor="l-bg-blue-dark" change={`${stats.weeklyCustomerChange.toFixed(1)}%`} changeType={stats.weeklyCustomerChange >= 0 ? 'increase' : 'decrease'} />
                <StatCard title="Services Offered" value={stats.totalServices.toLocaleString()} icon={<Briefcase />} bgColor="l-bg-orange-dark" change={""} changeType={'neutral'} />
                <StatCard title="Content Generated" value={stats.totalContent.toLocaleString()} icon={<Megaphone />} bgColor="l-bg-cherry" change={""} changeType={'neutral'} />
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Reels Generated" value={stats.reelsGenerated.toLocaleString()} icon={<Film />} bgColor="l-bg-blue-dark" change="" changeType="neutral" />
                <StatCard title="Scheduled" value={stats.scheduledContent.toLocaleString()} icon={<CalendarClock />} bgColor="l-bg-orange-dark" change="" changeType="neutral" />
                <StatCard title="Posted" value={stats.postedContent.toLocaleString()} icon={<Send />} bgColor="l-bg-green-dark" change="" changeType="neutral" />
                <StatCard title="Rejected" value={stats.rejectedContent.toLocaleString()} icon={<XCircle />} bgColor="l-bg-cherry" change="" changeType="neutral" />
            </div>


            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4 bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><BarChart3/>Sales Overview</CardTitle>
                        <CardDescription>Revenue from bookings over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={salesData}>
                                <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}/>
                                <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3 bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><PieChartIcon />Popular Services</CardTitle>
                        <CardDescription>Top 5 most booked services.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={serviceData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}/>
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <Card className="bg-card">
                <CardHeader>
                    <CardTitle className="text-lg">Recent Bookings</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentBookings.map(booking => (
                                <TableRow key={booking.id}>
                                    <TableCell>
                                        <div className="font-medium">{booking.customerName}</div>
                                        <div className="text-xs text-muted-foreground">{booking.bookingDate}</div>
                                    </TableCell>
                                    <TableCell>{booking.serviceName}</TableCell>
                                    <TableCell><span className="capitalize">{booking.status}</span></TableCell>
                                    <TableCell className="text-right">${booking.totalAmount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};


// --- GOOGLE DRIVE FILE EXPLORER ---

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}

interface Breadcrumb {
    id: string;
    name: string;
}

const FileActionMenu = ({ file, onRename, onDelete }: { file: GoogleDriveFile, onRename: () => void, onDelete: () => void }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={onRename}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const FileTile = ({ file, onDoubleClick, onRename, onDelete }: { file: GoogleDriveFile, onDoubleClick: () => void, onRename: () => void, onDelete: () => void }) => (
    <div 
      className="relative group flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-2 border-transparent bg-muted/50"
      onDoubleClick={onDoubleClick}
    >
      <FileIcon mimeType={file.mimeType} filename={file.name} className="h-16 w-16 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-center truncate w-full" title={file.name}>
        {file.name}
      </p>
      <FileActionMenu file={file} onRename={onRename} onDelete={onDelete} />
    </div>
);

const FileTileSkeleton = () => (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
        <Skeleton className="h-16 w-16 mb-3 rounded-lg" />
        <Skeleton className="h-4 w-24" />
    </div>
);

const DriveExplorer = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const folderId = searchParams.get("folderId") || "root";
    
    const [files, setFiles] = useState<GoogleDriveFile[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActionPending, startActionTransition] = useTransition();

    const { toast } = useToast();

    // State for dialogs
    const [dialogOpen, setDialogOpen] = useState<"create" | "rename" | "delete" | null>(null);
    const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
    const [newName, setNewName] = useState("");

    const fetchFiles = async (currentFolderId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/drive/files?folderId=${currentFolderId}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch files.");
            }
            const data = await response.json();
            setFiles(data.files || []);
            setBreadcrumbs(data.breadcrumbs || []);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles(folderId);
    }, [folderId]);

    const handleFileDoubleClick = (file: GoogleDriveFile) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            router.push(`/dashboard?folderId=${file.id}`);
        }
    };
    
    const handleAction = async () => {
        startActionTransition(async () => {
            let apiEndpoint = '';
            let payload: any = {};
            let successMessage = '';
            let errorMessage = '';

            try {
                switch(dialogOpen) {
                    case 'create':
                        apiEndpoint = '/api/drive/create-folder';
                        payload = { name: newName, parentId: folderId };
                        successMessage = `Folder "${newName}" created successfully.`;
                        errorMessage = 'Failed to create folder.';
                        break;
                    case 'rename':
                        apiEndpoint = '/api/drive/rename';
                        payload = { fileId: selectedFile?.id, newName: newName };
                        successMessage = `Renamed to "${newName}" successfully.`;
errorMessage = 'Failed to rename file.';
                        break;
                    case 'delete':
                        apiEndpoint = '/api/drive/delete';
                        payload = { fileId: selectedFile?.id };
                        successMessage = `"${selectedFile?.name}" deleted successfully.`;
                        errorMessage = 'Failed to delete file.';
                        break;
                    default:
                        return;
                }

                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || errorMessage);

                toast({ title: "Success", description: successMessage });
                setDialogOpen(null);
                fetchFiles(folderId); // Refresh list
            } catch (e: any) {
                toast({ title: "Error", description: e.message, variant: "destructive" });
            }
        });
    }
    
    const openDialog = (type: "create" | "rename" | "delete", file?: GoogleDriveFile) => {
        setDialogOpen(type);
        if (file) {
            setSelectedFile(file);
            setNewName(file.name);
        } else {
            setSelectedFile(null);
            setNewName("");
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {[...Array(8)].map((_, i) => <FileTileSkeleton key={i} />)}
                </div>
            );
        }
        if (error) {
            return <Alert variant="destructive" className="mt-4"><FileWarning className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
        }
        if (files.length === 0) {
            return <div className="text-center py-16"><FolderSearch className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Empty Folder</h3><p className="mt-1 text-sm text-muted-foreground">This folder doesn't contain any files.</p></div>;
        }
        const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const regularFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {[...folders, ...regularFiles].map((file) => (
                    <FileTile 
                        key={file.id} 
                        file={file} 
                        onDoubleClick={() => handleFileDoubleClick(file)}
                        onRename={() => openDialog("rename", file)}
                        onDelete={() => openDialog("delete", file)}
                    />
                ))}
            </div>
        );
    };

    const renderDialogContent = () => {
        switch (dialogOpen) {
            case "create":
                return (
                    <>
                        <DialogHeader>
                            <DialogTitle>Create New Folder</DialogTitle>
                            <DialogDescription>Enter a name for the new folder in the current directory.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="folder-name">Folder Name</Label>
                            <Input id="folder-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus/>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setDialogOpen(null)}>Cancel</Button>
                            <Button onClick={handleAction} disabled={isActionPending || !newName}>
                                {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Folder
                            </Button>
                        </DialogFooter>
                    </>
                );
            case "rename":
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle>Rename File/Folder</DialogTitle>
                            <DialogDescription>Enter a new name for "{selectedFile?.name}".</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="new-name">New Name</Label>
                            <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                        </div>
                        <DialogFooter>
                             <Button variant="ghost" onClick={() => setDialogOpen(null)}>Cancel</Button>
                            <Button onClick={handleAction} disabled={isActionPending || !newName}>
                                {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Rename
                            </Button>
                        </DialogFooter>
                    </>
                );
            case "delete":
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle>Are you absolutely sure?</DialogTitle>
                            <DialogDescription>
                                This action cannot be undone. This will permanently delete "{selectedFile?.name}".
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                             <Button variant="ghost" onClick={() => setDialogOpen(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleAction} disabled={isActionPending}>
                                {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                            </Button>
                        </DialogFooter>
                    </>
                );
            default:
                return null;
        }
    }

    return (
        <Card className="bg-card">
             <Dialog open={!!dialogOpen} onOpenChange={(open) => !open && setDialogOpen(null)}>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <CardTitle className="text-lg">My Drive</CardTitle>
                            <CardDescription>Navigate and manage your files and folders.</CardDescription>
                        </div>
                         <Button onClick={() => openDialog('create')} variant="outline">
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Create Folder
                        </Button>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground pt-4 overflow-x-auto pb-2">
                        <Button variant="ghost" size="sm" className="gap-1 flex-shrink-0" onClick={() => router.push('/dashboard')}>
                            <Home className="h-4 w-4"/> My Drive
                        </Button>
                        {breadcrumbs.map(bc => (
                             <div key={bc.id} className="flex items-center gap-1 flex-shrink-0">
                                <ChevronRight className="h-4 w-4"/>
                                <Button variant={bc.id === folderId ? "secondary" : "ghost"} size="sm" onClick={() => router.push(`/dashboard?folderId=${bc.id}`)}>
                                    <FolderIcon className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">{bc.name}</span>
                                    <span className="sm:hidden">{bc.name.length > 8 ? bc.name.substring(0, 8) + '...' : bc.name}</span>
                                </Button>
                             </div>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
                 <DialogContent>
                    {renderDialogContent()}
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// --- MAIN PAGE COMPONENT ---

export default function DashboardPage() {
    const { user } = useAuth();
    return (
        <div className="flex flex-col gap-8">
            <PageHeader 
                title={`Welcome back, ${user?.displayName?.split(' ')[0] || 'User'}!`}
                description="Here's a quick overview of your content and tools."
            />
            <AutoMarkDashboard />
            <DriveExplorer />
        </div>
    );
}

    