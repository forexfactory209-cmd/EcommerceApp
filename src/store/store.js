import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// --- MOCK DATA ---
export const BRANDS = [
  {
    id: 1,
    name: 'Nike',
    icon: 'N',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg',
    description: 'Performance footwear and sportswear with iconic designs.',
  },
  {
    id: 2,
    name: 'Adidas',
    icon: 'A',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
    description: 'Sportswear brand known for comfort and street style.',
  },
  {
    id: 3,
    name: 'Puma',
    icon: 'P',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/ff/Puma_AG.svg',
    description: 'Footwear and apparel blending sport and lifestyle.',
  },
  {
    id: 4,
    name: 'Apple',
    icon: 'Ap',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    description: 'Premium electronics and computers with sleek design.',
  },
];

export const PRODUCTS = [
  {
    id: 101,
    name: 'Air Max 90',
    brand: 'Nike',
    code: 'NK-101',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    description: 'The classic Air Max 90 offers comfort and style with a leather upper and iconic waffle sole.'
  },
  {
    id: 102,
    name: 'Ultra Boost',
    brand: 'Adidas',
    code: 'AD-102',
    price: 180.00,
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    description: 'Experience energy return like never before with the responsive Ultra Boost cushioning.'
  },
  {
    id: 103,
    name: 'MacBook Pro 14"',
    brand: 'Apple',
    code: 'AP-103',
    price: 1999.00,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    description: 'Supercharged by M2 Pro. Longest battery life ever in a Mac.'
  },
  {
    id: 104,
    name: 'Smart Watch Series 7',
    brand: 'Apple',
    code: 'AP-104',
    price: 399.00,
    image: 'https://images.unsplash.com/photo-1546868871-7041f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    description: 'Full screen ahead. The largest, most advanced display yet.'
  },
];

// --- STORE (State Management) ---
export const useStore = create((set, get) => ({
  // Catalog and orders
  products: PRODUCTS,
  orders: [],
  seenDeliveredOrdersCount: 0,

  // User type / role
  userType: 'customer', // 'customer' | 'brand'
  setUserType: (type) => set({ userType: type }),

  // Basic user profile
  userName: '',
  userEmail: '',
  userProfile: null,
  setUserProfile: (profile) =>
    set((state) => {
      const safeProfile = profile || {};
      return {
        userName: safeProfile.name ?? state.userName ?? '',
        userEmail: safeProfile.email ?? state.userEmail ?? '',
        userProfile: {
          ...(state.userProfile || {}),
          ...safeProfile,
        },
      };
    }),

  // Auth state (Supabase)
  authUserId: null,
  authEmail: null,
  authRole: null, // 'customer' | 'brand'
  brandLogoUrl: '',
  setAuthUser: ({ id, email, role, name, brandLogoUrl }) =>
    set((state) => ({
      authUserId: id,
      authEmail: email,
      authRole: role,
      userType: role === 'brand' ? 'brand' : 'customer',
      userName: name || state.userName,
      userEmail: email || state.userEmail,
      brandLogoUrl: brandLogoUrl || state.brandLogoUrl,
    })),
  setBrandLogoUrl: (url) => set({ brandLogoUrl: url || '' }),
  clearAuthUser: () =>
    set({
      authUserId: null,
      authEmail: null,
      authRole: null,
      userType: 'customer',
      userName: '',
      userEmail: '',
      userProfile: null,
      seenDeliveredOrdersCount: 0,
      brandLogoUrl: '',
    }),

  // Customer onboarding flag (in-memory)
  hasSeenCustomerOnboarding: false,
  setHasSeenCustomerOnboarding: (value) =>
    set({ hasSeenCustomerOnboarding: !!value }),

  // Wishlist
  wishlist: [],
  // Followed brands (by brand id)
  followedBrandIds: [],

  // Product ratings (in-memory, per product id)
  productRatings: {}, // { [productId]: number }
  setProductRating: (productId, rating) => set((state) => {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    if (!value) return state;
    return {
      productRatings: {
        ...state.productRatings,
        [productId]: value,
      },
    };
  }),

  loadFollowedBrands: async () => {
    try {
      const authUserId = get().authUserId;
      if (!authUserId) return;

      const { data, error } = await supabase
        .from('brand_follows')
        .select('brand_id')
        .eq('user_id', authUserId);

      if (error) {
        console.warn('Failed to load followed brands', error.message || error);
        return;
      }

      const ids = (data || [])
        .map((row) => row.brand_id) // Keep as UUID string
        .filter((v) => v); // Filter out null/undefined

      console.log('[Store] Loaded followed brand IDs:', ids);
      set({ followedBrandIds: ids });
    } catch (e) {
      console.warn('Failed to load followed brands', e.message || e);
    }
  },

  toggleFollowBrand: async (brandId) => {
    console.log('[Store] toggleFollowBrand called with brandId:', brandId, typeof brandId);
    if (!brandId) return;

    // Don't convert to number - keep as string/UUID
    const authUserId = get().authUserId;
    console.log('[Store] authUserId:', authUserId);

    // Update local state immediately for snappy UI
    set((state) => {
      const exists = state.followedBrandIds.includes(brandId);
      console.log('[Store] Currently followed?', exists);
      return {
        followedBrandIds: exists
          ? state.followedBrandIds.filter((id) => id !== brandId)
          : [...state.followedBrandIds, brandId],
      };
    });

    // Persist to Supabase if we have an authenticated user
    if (!authUserId) return;

    try {
      const state = get();
      const isNowFollowed = state.followedBrandIds.includes(brandId);
      console.log('[Store] isNowFollowed:', isNowFollowed);

      if (isNowFollowed) {
        console.log('[Store] Inserting into brand_follows:', { user_id: authUserId, brand_id: brandId });
        const { data, error } = await supabase
          .from('brand_follows')
          .insert({
            user_id: authUserId,
            brand_id: brandId,
          })
          .select()
          .single();
        if (error) {
          console.warn('Failed to persist follow brand', error.message || error);
        } else {
          console.log('[Store] Successfully inserted into brand_follows. Inserted data:', data);
          console.log('[Store] Inserted brand_id type:', typeof data?.brand_id, 'value:', data?.brand_id);
        }
      } else {
        const { error } = await supabase
          .from('brand_follows')
          .delete()
          .eq('user_id', authUserId)
          .eq('brand_id', brandId);
        if (error) {
          console.warn('Failed to delete follow brand', error.message || error);
        }
      }
    } catch (e) {
      console.warn('Failed to persist follow brand', e.message || e);
    }
  },

  deletedProductIds: [],

  // Cart
  cart: [],
  addToCart: (product) => set((state) => {
    const existing = state.cart.find((item) => item.id === product.id);
    if (existing) {
      return {
        cart: state.cart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    }
    return { cart: [...state.cart, { ...product, quantity: 1 }] };
  }),
  removeFromCart: (id) => set((state) => ({
    cart: state.cart.filter((item) => item.id !== id),
  })),
  increaseQuantity: (id) => set((state) => ({
    cart: state.cart.map((item) =>
      item.id === id ? { ...item, quantity: (item.quantity || 1) + 1 } : item,
    ),
  })),
  decreaseQuantity: (id) => set((state) => {
    const existing = state.cart.find((item) => item.id === id);
    if (!existing) return state;

    if ((existing.quantity || 1) <= 1) {
      return {
        cart: state.cart.filter((item) => item.id !== id),
      };
    }

    return {
      cart: state.cart.map((item) =>
        item.id === id ? { ...item, quantity: (item.quantity || 1) - 1 } : item,
      ),
    };
  }),
  clearCart: () => set({ cart: [] }),

  // Checkout: move cart to orders and clear cart
  checkout: () => set((state) => {
    if (state.cart.length === 0) return state;

    const total = state.cart.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0,
    );

    const newOrder = {
      id: Date.now(),
      items: state.cart,
      total,
      status: 'Pending',
      date: new Date().toLocaleDateString(),
    };

    return {
      orders: [newOrder, ...state.orders],
      cart: [],
    };
  }),

  setSeenDeliveredOrdersCount: (count) =>
    set({ seenDeliveredOrdersCount: typeof count === 'number' ? count : 0 }),

  // Vendor actions
  addProduct: (product) => set((state) => ({
    products: [product, ...state.products],
  })),
  updateProduct: (product) => set((state) => ({
    products: state.products.map((p) =>
      p.id === product.id ? { ...p, ...product } : p,
    ),
  })),
  setProducts: (products) => set(() => ({
    products: Array.isArray(products) ? products : [],
  })),
  deleteProduct: (id) => set((state) => ({
    products: state.products.filter((p) => p.id !== id),
    cart: state.cart.filter((item) => item.id !== id),
    wishlist: state.wishlist.filter((item) => item.id !== id),
    deletedProductIds: [...(state.deletedProductIds || []), id],
  })),
  updateOrderStatus: (orderId, status) => set((state) => ({
    orders: state.orders.map((o) =>
      o.id === orderId ? { ...o, status } : o
    ),
  })),
  // Generic addOrder action (used by Billing flow)
  addOrder: (order) => set((state) => ({
    orders: [order, ...state.orders],
  })),
  // Replace orders list (used when loading from Supabase)
  setOrders: (orders) => set({ orders }),

  // Wishlist actions
  addToWishlist: (product) => set((state) => {
    const exists = state.wishlist.find((item) => item.id === product.id);
    if (exists) return state;
    return { wishlist: [product, ...state.wishlist] };
  }),
  removeFromWishlist: (id) => set((state) => ({
    wishlist: state.wishlist.filter((item) => item.id !== id),
  })),
  clearWishlistByProductIds: (ids) => set((state) => ({
    wishlist: state.wishlist.filter((item) => !ids.includes(item.id)),
  })),
}));
