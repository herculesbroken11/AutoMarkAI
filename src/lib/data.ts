import { Megaphone, Film, CalendarClock, Bot } from "lucide-react";

export const recentActivities = [
  {
    id: 1,
    icon: Megaphone,
    description: "Generated 5 new captions for Tesla Model 3 Ceramic Coating.",
    time: "5m ago",
  },
  {
    id: 2,
    icon: Film,
    description: "New reel created for BMW X5 Full Detail.",
    time: "30m ago",
  },
  {
    id: 3,
    icon: CalendarClock,
    description: "Scheduled Instagram post for 7:00 PM.",
    time: "1h ago",
  },
  {
    id: 4,
    icon: Bot,
    description: "AI suggested optimal posting times for TikTok.",
    time: "2h ago",
  },
  {
    id: 5,
    icon: Megaphone,
    description: "Generated 3 new captions for Porsche 911 Paint Correction.",
    time: "5h ago",
  },
];

export const pendingPosts = [
  {
    id: 'content_1',
    platform: 'instagram',
    vehicle: 'Tesla Model 3',
    service: 'Ceramic Coating',
    image: 'https://picsum.photos/seed/3/600/400',
    caption: 'From dull to dazzling! ✨ This Tesla Model 3 got our full ceramic coating treatment. Look at that mirror finish! #Tesla #CeramicCoating #AutoDetailing',
  },
  {
    id: 'content_2',
    platform: 'facebook',
    vehicle: 'Ford F-150',
    service: 'Interior Detail',
    image: 'https://picsum.photos/seed/5/600/400',
    caption: 'We erased years of wear and tear from this Ford F-150s interior. Now it looks and smells brand new! Ready for your own transformation? Book today!',
  },
  {
    id: 'content_3',
    platform: 'tiktok',
    vehicle: 'BMW X5',
    service: 'Full Detail Package',
    video: 'https://www.w3schools.com/html/mov_bbb.mp4',
    caption: 'Watch this satisfying transformation! Our Full Detail package brought this BMW X5 back to life. #cardetailing #bmw #transformation #satisfying',
  },
];

export const scheduledPosts = [
    {
      id: 'sched_1',
      platform: 'instagram',
      vehicle: 'Porsche 911',
      service: 'Paint Correction',
      image: 'https://picsum.photos/seed/9/600/400',
      post_time: 'Today, 7:00 PM',
    },
    {
      id: 'sched_2',
      platform: 'google_business',
      vehicle: 'Audi Q5',
      service: 'Window Tinting',
      image: 'https://picsum.photos/seed/8/600/400',
      post_time: 'Tomorrow, 10:00 AM',
    },
];
