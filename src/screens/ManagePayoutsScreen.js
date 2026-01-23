import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { useStore } from '../store/store';

const PROVIDERS = [
  { id: 'zaad', label: 'Zaad Service' },
  { id: 'edahab', label: 'Edahab Service' },
];

const ManagePayoutsScreen = ({ navigation }) => {
  const payoutMethods = useStore((state) => state.payoutMethods || []);
  const addOrUpdatePayoutMethod = useStore((state) => state.addOrUpdatePayoutMethod);
  const removePayoutMethod = useStore((state) => state.removePayoutMethod);

  const [selectedProvider, setSelectedProvider] = useState('zaad');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editingId, setEditingId] = useState(null); // Supabase uuid when editing

  const existingCount = Array.isArray(payoutMethods) ? payoutMethods.length : 0;

  const handleSave = () => {
    if (!phoneNumber.trim()) {
      return;
    }

    const providerConfig = PROVIDERS.find((p) => p.id === selectedProvider);
    const label = providerConfig ? providerConfig.label : selectedProvider;

    addOrUpdatePayoutMethod({
      id: editingId || undefined, // uuid for edit, undefined for new
      provider: selectedProvider,
      label,
      phoneNumber: phoneNumber.trim(),
    });

    // reset to create mode
    setPhoneNumber('');
    setEditingId(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Payouts</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Existing Methods</Text>
          <Text style={styles.sectionSubtitle}>
            {existingCount} Account{existingCount === 1 ? '' : 's'} Linked
          </Text>
        </View>

        {existingCount > 0 ? (
          <View style={{ marginBottom: 16 }}>
            {payoutMethods.map((m) => (
              <View key={m.id} style={styles.methodCard}>
                <View style={styles.methodIcon} />
                <View style={styles.methodInfo}>
                  <Text style={styles.methodTitle}>{m.label}</Text>
                  <Text style={styles.methodSubtitle}>
                    Linked · {m.phoneNumber || 'Unknown'}
                  </Text>
                </View>
                <View style={styles.methodActions}>
                  <TouchableOpacity
                    style={styles.methodActionButton}
                    onPress={() => {
                      // Use Supabase uuid for editing
                      setEditingId(m.id);
                      setSelectedProvider(m.provider || 'zaad');
                      setPhoneNumber(m.phoneNumber || '');
                    }}
                  >
                    <Text style={styles.methodActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.methodActionButton}
                    onPress={() => removePayoutMethod(m.id)}
                  >
                    <Text style={styles.methodActionText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No payout methods linked yet.</Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Add New Method</Text>

        <View style={styles.addCard}>
          <Text style={styles.fieldLabel}>Service Provider</Text>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => {
              const active = selectedProvider === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.providerChip, active && styles.providerChipActive]}
                  onPress={() => setSelectedProvider(p.id)}
                >
                  <Text style={active ? styles.providerChipTextActive : styles.providerChipText}>
                    {p.id === 'zaad' ? 'Zaad' : 'Edahab'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="063-XXXX-XXX"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
            <Text style={styles.primaryButtonText}>
              {editingId ? 'Update Payout Method' : 'Add Payout Method'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>All payout methods are verified.</Text>
          <Text style={styles.infoText}>
            For your security, changes may take up to 24 hours to reflect on your active withdrawals.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ManagePayoutsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginRight: 10,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  methodSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  methodActions: {
    marginLeft: 8,
  },
  methodActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  methodActionText: {
    fontSize: 12,
    color: '#090966',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  addCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  providerChip: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  providerChipActive: {
    backgroundColor: '#090966',
    borderColor: '#090966',
  },
  providerChipText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  providerChipTextActive: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  textInput: {
    fontSize: 14,
    color: '#111827',
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#090966',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#eef2ff',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#4b5563',
  },
});