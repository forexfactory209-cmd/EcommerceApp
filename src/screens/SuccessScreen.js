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
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemQty}>x{item.quantity}</Text>
      <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
    </View>
  );

  // Announcement success mode
  if (type === 'announcement') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.title}>{customTitle || 'Announcement Sent'}</Text>
          <Text style={styles.message}>
            {customMessage || 'Your announcement has been sent to your followers.'}
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          >
            <Text style={styles.buttonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Default: order success mode
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.title}>Order Successful</Text>
        <Text style={styles.message}>
          Thank you for your purchase! Your order is being processed.
        </Text>

        {order && (
          <View style={styles.orderSection}>
            <FlatList
              data={order.items}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              style={styles.list}
              scrollEnabled={false}
            />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>${order.shipping.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>${order.total.toFixed(2)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Main', { screen: 'HomeTab' })}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SuccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  orderSection: {
    width: '100%',
    marginBottom: 16,
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
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
