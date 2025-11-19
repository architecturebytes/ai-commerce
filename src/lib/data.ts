export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
}

export const DUMMY_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Delta Pro",
    category: "Laptops",
    price: 1299.99,
    description: "A powerful and sleek laptop for professionals and creatives.",
    imageUrl: "images/DeltaProLaptop.jpg",
  },
  {
    id: 2,
    name: "Sonic Sphere Earbuds",
    category: "Audio",
    price: 149.99,
    description: "Crystal-clear sound with noise-cancellation technology.",
    imageUrl: "images/SonicSphereEarBuds.jpg",
  },
  {
    id: 3,
    name: "Chrono Watch",
    category: "Wearables",
    price: 249.99,
    description: "A smart watch with a classic design and modern features.",
    imageUrl: "images/ChronoWatch.jpg",
  },
  {
    id: 4,
    name: "Nova Book Mini",
    category: "Laptops",
    price: 999.99,
    description: "Ultra-lightweight and portable for work on the go.",
    imageUrl: "images/NovaBookMiniLaptop.jpg",
  },
  {
    id: 5,
    name: "Sonic Wave Speaker",
    category: "Audio",
    price: 89.99,
    description: "A portable bluetooth speaker with rich, room-filling sound.",
    imageUrl: "images/SonicWaveSpeaker.jpg",
  },
  {
    id: 6,
    name: "Fit Track Band",
    category: "Wearables",
    price: 79.99,
    description: "Monitor your fitness goals with this sleek and comfortable band.",
    imageUrl: "images/FitTrackBand.jpg",
  },
];
