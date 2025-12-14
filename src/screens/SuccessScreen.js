import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SuccessScreen = ({ navigation, route }) => {
  const order = route?.params?.order;
  const type = route?.params?.type;
  const customTitle = route?.params?.title;
  const customMessage = route?.params?.message;

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <Text style={styles.itemName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.itemQty}>x{item.quantity}</Text>
      <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
    </View>
  );

  // Announcement success mode
  if (type === 'announcement') {
    return (
      <SafeAreaView style={styles.fullScreenContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.illustrationWrapper}>
            <View style={styles.phoneOutline}>
              <View style={styles.phoneInner}>
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.title}>{customTitle || 'Announcement Sent'}</Text>
          <Text style={styles.message}>
            {customMessage || 'Your announcement has been sent to your followers.'}
          </Text>
        </View>

        <View style={styles.bottomButtonsWrapper}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          >
            <Text style={styles.secondaryButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Default: order success mode
  return (
    <SafeAreaView style={styles.fullScreenContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'HomeTab' })}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.illustrationWrapper}>
          <View style={styles.phoneOutline}>
            <View style={styles.phoneInner}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.title}>Order Confirmed!</Text>
        <Text style={styles.message}>
          Your order has been confirmed, we will send you confirmation email shortly.
        </Text>
      </View>

      <View style={styles.bottomButtonsWrapper}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('TrackOrder')}
        >
          <Text style={styles.secondaryButtonText}>Go to Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Main', { screen: 'HomeTab' })}
        >
          <Text style={styles.primaryButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SuccessScreen;

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: '#111827',
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  illustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  phoneOutline: {
    width: 180,
    height: 280,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneInner: {
    width: '78%',
    height: '80%',
    borderRadius: 28,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9CA3AF',
    textAlign: 'center',
    marginHorizontal: 12,
    marginBottom: 32,
  },
  orderSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 24,
  },
  list: {
    flexGrow: 0,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  itemQty: {
    width: 36,
    textAlign: 'center',
    color: '#6b7280',
  },
  itemPrice: {
    width: 80,
    textAlign: 'right',
    fontWeight: '600',
    color: '#111827',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  summaryLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  summaryValue: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  bottomButtonsWrapper: {
    width: '100%',
    marginTop: 8,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#F4F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
