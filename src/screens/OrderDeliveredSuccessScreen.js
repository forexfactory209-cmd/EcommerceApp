import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
  background: '#FFFFFF',
  primaryCircle: '#0F172A',
  textPrimary: '#111827',
  textSecondary: '#9CA3AF',
};

const OrderDeliveredSuccessScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.circle}>
          <Text style={styles.check}>✔</Text>
        </View>
        <Text style={styles.title}>Delivery Confirmed</Text>
        <Text style={styles.subtitle}>
          You confirmed that this order was delivered successfully.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('TrackOrder')}
        >
          <Text style={styles.primaryButtonText}>BACK TO ORDERS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OrderDeliveredSuccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryCircle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  check: {
    fontSize: 56,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primaryCircle,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
