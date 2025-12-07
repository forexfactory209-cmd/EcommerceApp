import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Home, ShoppingBag, User, Store, Heart, Zap, Tag } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';

// Import Screens
import HomeScreen from '../screens/HomeScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import CartScreen from '../screens/CartScreen';
import BillingScreen from '../screens/BillingScreen';
import SuccessScreen from '../screens/SuccessScreen';
import VendorScreen from '../screens/VendorScreen';
import FlashSaleScreen from '../screens/FlashSaleScreen';
import EditFlashSaleScreen from '../screens/EditFlashSaleScreen';
import AddProductScreen from '../screens/AddProductScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import AddressesScreen from '../screens/AddressesScreen';
import BrandScreen from '../screens/BrandScreen';
import BrandOnboardingScreen from '../screens/BrandOnboardingScreen';
import CustomerOnboardingScreen from '../screens/CustomerOnboardingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CreateAnnouncementScreen from '../screens/CreateAnnouncementScreen';
import AdminBrandsScreen from '../screens/AdminBrandsScreen';
import AdminVendorScreen from '../screens/AdminVendorScreen';
import WishlistScreen from '../screens/WishlistScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import EditProductScreen from '../screens/EditProductScreen';
import AllProductsScreen from '../screens/AllProductsScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AllBrandsScreen from '../screens/AllBrandsScreen';
import AdminCustomersScreen from '../screens/AdminCustomersScreen';
import AdminCustomerDetailsScreen from '../screens/AdminCustomerDetailsScreen';
import TrackOrderScreen from '../screens/TrackOrderScreen';
import TrackOrderDetailsScreen from '../screens/TrackOrderDetailsScreen';
import PromoCodesScreen from '../screens/PromoCodesScreen';
import { useStore } from '../store/store';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const cartItems = useStore((state) => state.cart.length);
  const pendingOrders = useStore((state) =>
    state.orders.filter((o) => o.status !== 'Delivered').length,
  );
  const wishlistCount = useStore((state) => state.wishlist.length);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
            backgroundColor: '#ffffff', 
            borderTopWidth: 0,
            elevation: 0,
            height: 60,
            paddingBottom: 10 
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{
            tabBarIcon: ({color}) => <Home color={color} size={24} />
        }}
      />
      {userType !== 'brand' && authRole !== 'admin' && (
        <Tab.Screen
          name="FlashSaleTab"
          component={FlashSaleScreen}
          options={{
            tabBarIcon: ({ color }) => <Zap color={color} size={24} />,
          }}
        />
      )}
      {userType !== 'brand' && authRole !== 'admin' && (
        <Tab.Screen 
          name="Wishlist" 
          component={WishlistScreen} 
          options={{
              tabBarIcon: ({color}) => (
                <View>
                  <Heart color={color} size={24} />
                  {wishlistCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{wishlistCount}</Text>
                    </View>
                  )}
                </View>
              )
          }}
        />
      )}
      {userType === 'brand' && authRole !== 'admin' && (
        <>
          <Tab.Screen 
            name="Vendor" 
            component={VendorScreen} 
            options={{
                tabBarIcon: ({color}) => (
                    <View style={{ alignItems: 'center' }}>
                      <Store color={color} size={24} />
                      {pendingOrders > 0 && (
                        <>
                          <View style={styles.vendorBadge}>
                            <Text style={styles.vendorBadgeText}>{pendingOrders}</Text>
                          </View>
                          <Text style={styles.vendorHintText} numberOfLines={1}>
                            {pendingOrders === 1 ? '1 order waiting' : `${pendingOrders} orders`}
                          </Text>
                        </>
                      )}
                    </View>
                )
            }}
          />
          <Tab.Screen
            name="PromoCodes"
            component={PromoCodesScreen}
            options={{
              tabBarIcon: ({ color }) => <Tag color={color} size={24} />,
            }}
          />
        </>
      )}
      {userType !== 'brand' && authRole !== 'admin' && (
        <Tab.Screen 
          name="Cart" 
          component={CartScreen} 
          options={{
              tabBarIcon: ({color}) => (
                  <View>
                      <ShoppingBag color={color} size={24} />
                      {cartItems > 0 && (
                          <View style={styles.cartBadge}>
                              <Text style={styles.cartBadgeText}>{cartItems}</Text>
                          </View>
                      )}
                  </View>
              )
          }}
        />
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
            tabBarIcon: ({color}) => <User color={color} size={24} />
        }}
      />
    </Tab.Navigator>
  );
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="CustomerOnboarding" component={CustomerOnboardingScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Addresses" component={AddressesScreen} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Vendor" component={VendorScreen} />
        <Stack.Screen name="FlashSale" component={FlashSaleScreen} />
        <Stack.Screen name="EditFlashSale" component={EditFlashSaleScreen} />
        <Stack.Screen name="Billing" component={BillingScreen} />
        <Stack.Screen name="Success" component={SuccessScreen} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} />
        <Stack.Screen name="EditProduct" component={EditProductScreen} />
        <Stack.Screen name="AllProducts" component={AllProductsScreen} />
        <Stack.Screen name="Brand" component={BrandScreen} />
        <Stack.Screen name="BrandOnboarding" component={BrandOnboardingScreen} />
        <Stack.Screen name="CreateAnnouncement" component={CreateAnnouncementScreen} />
        <Stack.Screen name="AdminBrands" component={AdminBrandsScreen} />
        <Stack.Screen name="AdminVendor" component={AdminVendorScreen} />
        <Stack.Screen name="AdminProducts" component={AdminProductsScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AllBrands" component={AllBrandsScreen} />
        <Stack.Screen name="AdminCustomers" component={AdminCustomersScreen} />
        <Stack.Screen name="AdminCustomerDetails" component={AdminCustomerDetailsScreen} />
        <Stack.Screen name="TrackOrder" component={TrackOrderScreen} />
        <Stack.Screen name="TrackOrderDetails" component={TrackOrderDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  profileText: {
    fontSize: 20,
    fontWeight: '700',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  vendorBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  vendorHintText: {
    marginTop: 2,
    fontSize: 10,
    color: '#6B7280',
  },
});
