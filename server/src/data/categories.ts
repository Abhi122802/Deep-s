export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  image: string;
  itemCount: number;
  isActive: boolean;
}

export const CATEGORIES_DATA: CategoryInfo[] = [
  {
    id: 'Birthday',
    name: 'Birthday Cakes',
    slug: 'birthday-cakes',
    tagline: 'Joyful centerpieces crafted for birthdays of every milestone',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=700&q=80',
    itemCount: 8,
    isActive: true,
  },
  {
    id: 'Anniversary',
    name: 'Anniversary Cakes',
    slug: 'anniversary-cakes',
    tagline: 'Heartfelt romantic expressions in velvet, berries & gold leaf',
    image: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=700&q=80',
    itemCount: 6,
    isActive: true,
  },
  {
    id: 'Chocolate',
    name: 'Chocolate Cakes',
    slug: 'chocolate-cakes',
    tagline: 'Pure Belgian couvertures, rich ganaches & molten truffles',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80',
    itemCount: 10,
    isActive: true,
  },
  {
    id: 'Designer',
    name: 'Designer Cakes',
    slug: 'designer-cakes',
    tagline: 'Artisanal hand-piped florals, macarons, and bespoke tiers',
    image: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=700&q=80',
    itemCount: 7,
    isActive: true,
  },
  {
    id: 'Photo',
    name: 'Photo Cakes',
    slug: 'photo-cakes',
    tagline: 'High-definition edible sugar-sheet portraits & memories',
    image: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=700&q=80',
    itemCount: 5,
    isActive: true,
  },
  {
    id: 'Eggless',
    name: '100% Eggless Cakes',
    slug: 'eggless-cakes',
    tagline: 'Guaranteed pure vegetarian, incredibly moist & decadent',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80',
    itemCount: 12,
    isActive: true,
  },
  {
    id: 'Wedding',
    name: 'Wedding Cakes',
    slug: 'wedding-cakes',
    tagline: 'Grand celebratory towers adorned with cascading pearls & flora',
    image: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?auto=format&fit=crop&w=700&q=80',
    itemCount: 4,
    isActive: true,
  },
];
