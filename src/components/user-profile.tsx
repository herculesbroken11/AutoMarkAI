// This component displays the logged-in user's profile information and a logout button.
"use client";

import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronUp } from "lucide-react";

export default function UserProfile() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.length > 2 ? initials.substring(0, 2) : initials;
  }

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-auto p-2">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden group-data-[state=expanded]:block overflow-hidden">
                        <p className="text-sm font-medium truncate">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                </div>
                <ChevronUp className="h-4 w-4 hidden group-data-[state=expanded]:block shrink-0" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                {user.email}
                </p>
            </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
