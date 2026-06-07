// components/Marketing/videosData.ts

export type VideoType = 'youtube' | 'instagram';

export interface VideoItem {
  id: string;
  type: VideoType;
  embedId: string; // YouTube video ID or Instagram post shortcode
  thumbnail: string; // Path to thumbnail image
  title: string;
  description: string;
}

export const videos: VideoItem[] = [
  {
    id: '1',
    type: 'youtube',
    embedId: 'tf1THn80uc4',
    thumbnail: '/images/thumbnails/Run-your-poker-tournament-on-any-device.jpg', // Add your thumbnail
    title: 'Create, run and finalize from any device',
    description: 'See how a typical tournament night runs with Open Bar League.',
  },
  {
    id: '2',
    type: 'instagram',
    embedId: 'DYj6Bs-xsNh',
    thumbnail: '/images/thumbnails/KO-from-your-phone.jpg', // Add your thumbnail
    title: 'KO from your phone',
    description: 'KOing players is easy, on any device.',
  },
  {
    id: '3',
    type: 'instagram',
    embedId: 'DZRFWsqtO9d',
    thumbnail: '/images/thumbnails/any-phone-is-a-game-timer.jpg', // Add your thumbnail
    title: 'Any phone is a game timer',
    description: 'Any player can pull up the live synced game timer on their phone.',
  },
];
