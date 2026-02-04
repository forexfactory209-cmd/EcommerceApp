import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Image as ExpoImage } from 'expo-image';

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  resolved: 'Resolved',
};

const AdminSupportTicketDetailsScreen = ({ route, navigation }) => {
  const { ticketId } = route.params || {};

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('support_tickets')
        .select(
          'id, user_id, ticket_type, order_id_text, description, screenshot_url, status, created_at, order_issue_reason, brand_done',
        )
        .eq('id', ticketId)
        .maybeSingle();

      if (error) {
        console.warn('AdminSupportTicketDetails: error loading ticket', error.message || error);
        Alert.alert('Error', error.message || 'Failed to load ticket.');
        return;
      }

      if (!data) {
        Alert.alert('Not found', 'This ticket no longer exists.');
        return;
      }

      const created = data.created_at ? new Date(data.created_at) : null;

      let productName = null;
      let productImageUrl = null;

      const orderId = data.order_id_text ? Number(data.order_id_text) : null;
      if (Number.isFinite(orderId)) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, name, image_url')
          .eq('order_id', orderId)
          .limit(1)
          .maybeSingle();

        if (!itemsError && itemsData) {
          productName = itemsData.name || null;
          productImageUrl = itemsData.image_url || null;
        }
      }

      setTicket({
        id: data.id,
        userId: data.user_id,
        type: data.ticket_type,
        orderIdText: data.order_id_text,
        description: data.description,
        screenshotUrl: data.screenshot_url,
        status: data.status || 'open',
        createdAtLabel: created ? created.toLocaleString() : 'Unknown',
        orderIssueReason: data.order_issue_reason || null,
        brandDone: !!data.brand_done,
        productName,
        productImageUrl,
      });
    } catch (e) {
      console.warn('AdminSupportTicketDetails: exception loading ticket', e.message || e);
      Alert.alert('Error', 'Unexpected error while loading ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      loadTicket();
    }, [loadTicket]),
  );

  const handleChangeStatus = async (nextStatus) => {
    if (!ticket || !ticket.id) return;

    if (nextStatus === ticket.status) return;

    try {
      setUpdatingStatus(true);

      const { error } = await supabase
        .from('support_tickets')
        .update({ status: nextStatus })
        .eq('id', ticket.id);

      if (error) {
        console.warn('AdminSupportTicketDetails: error updating status', error.message || error);
        Alert.alert('Error', error.message || 'Failed to update status.');
        setUpdatingStatus(false);
        return;
      }

      setTicket((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch (e) {
      console.warn('AdminSupportTicketDetails: exception updating status', e.message || e);
      Alert.alert('Error', 'Unexpected error while updating status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusLabel = ticket ? STATUS_LABELS[ticket.status] || ticket.status || 'Open' : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Reports</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket Details</Text>
      </View>

      {loading && !ticket ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : !ticket ? (
        <View style={styles.loadingWrapper}>
          <Text style={styles.emptyText}>Ticket not found.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.primaryCard}>
            <View style={styles.ticketBadgeCircleLarge}>
              <Text style={styles.ticketBadgeLargeText}>
                {ticket.type ? ticket.type[0].toUpperCase() : 'T'}
              </Text>
            </View>
            <Text style={styles.ticketTypeTitle}>
              {ticket.type === 'order_issue'
                ? 'Order Issue'
                : ticket.type === 'technical_glitch'
                ? 'Technical Glitch'
                : ticket.type === 'vendor_dispute'
                ? 'Vendor Dispute'
                : ticket.type || 'Ticket'}
            </Text>
            <Text style={styles.ticketMetaMain}>Ticket ID: {ticket.id}</Text>
            <Text style={styles.ticketMetaSub}>User: {ticket.userId}</Text>
            <Text style={styles.ticketMetaSub}>Created: {ticket.createdAtLabel}</Text>
          </View>

          <View style={styles.statusSection}>
            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.statusChipsRow}>
              {[
                { id: 'open', label: 'Open' },
                { id: 'in_review', label: 'In Review' },
                { id: 'resolved', label: 'Resolved' },
              ].map((opt) => {
                const active = ticket.status === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                    onPress={() => handleChangeStatus(opt.id)}
                    disabled={updatingStatus}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={active ? styles.statusChipTextActive : styles.statusChipText}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.currentStatusText}>Current: {statusLabel}</Text>
          </View>

          {ticket.type === 'order_issue' && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Seller notification</Text>
              <Text style={styles.sectionHint}>
                When you approve this dispute and want it visible to the seller, mark it as
                resolved. This will list the dispute in the seller's Disputes &amp; Support view.
              </Text>
              <TouchableOpacity
                style={[styles.statusChip, styles.statusChipActive, { marginTop: 8, alignSelf: 'flex-start' }]}
                onPress={() => handleChangeStatus('resolved')}
                disabled={updatingStatus || ticket.status === 'resolved'}
                activeOpacity={0.9}
              >
                <Text style={styles.statusChipTextActive}>
                  {ticket.status === 'resolved'
                    ? 'Seller notified'
                    : 'Notify seller (mark as resolved)'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {ticket.orderIdText ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Related Order</Text>
              <Text style={styles.sectionValue}>{ticket.orderIdText}</Text>
            </View>
          ) : null}

          {ticket.productName || ticket.productImageUrl ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Product</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {ticket.productImageUrl ? (
                  <Image
                    source={{ uri: ticket.productImageUrl }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : null}
                {ticket.productName ? (
                  <Text style={[styles.sectionValue, { marginLeft: ticket.productImageUrl ? 10 : 0 }]}
                    numberOfLines={2}
                  >
                    {ticket.productName}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.descriptionText}>{ticket.description || 'No description provided.'}</Text>
          </View>

          {ticket.screenshotUrl ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Screenshot</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setScreenshotModalVisible(true)}
              >
                <ExpoImage
                  source={{ uri: ticket.screenshotUrl }}
                  style={styles.screenshotImage}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={150}
                />
              </TouchableOpacity>
              <Text style={styles.sectionHint}>Tap to view full size or download.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
      <Modal
        visible={!!screenshotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScreenshotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Screenshot</Text>
            {ticket?.screenshotUrl ? (
              <ExpoImage
                source={{ uri: ticket.screenshotUrl }}
                style={styles.modalImage}
                contentFit="contain"
                cachePolicy="disk"
              />
            ) : null}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setScreenshotModalVisible(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Close</Text>
              </TouchableOpacity>
              {ticket?.screenshotUrl ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => Linking.openURL(ticket.screenshotUrl)}
                >
                  <Text style={styles.modalButtonPrimaryText}>Open in browser</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminSupportTicketDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  backIcon: {
    fontSize: 16,
    color: '#F9FAFB',
    marginRight: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  primaryCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  ticketBadgeCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ticketBadgeLargeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  ticketTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  ticketMetaMain: {
    fontSize: 13,
    color: '#E5E7EB',
  },
  ticketMetaSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  statusChipsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  statusChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  statusChipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  statusChipTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  currentStatusText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionValue: {
    fontSize: 13,
    color: '#111827',
  },
  descriptionText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
  },
  linkText: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 4,
  },
  sectionHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  screenshotImage: {
    marginTop: 8,
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  modalButtonSecondary: {
    backgroundColor: '#E5E7EB',
  },
  modalButtonSecondaryText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  modalButtonPrimary: {
    backgroundColor: '#2563EB',
  },
  modalButtonPrimaryText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
