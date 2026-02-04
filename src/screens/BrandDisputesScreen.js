import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { ArrowLeft, Bell, Filter } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const STATUS_LABELS = {
  open: 'Unresolved',
  in_review: 'In Review',
  resolved: 'Resolved',
};

const BrandDisputesScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const brandDisputesDirty = useStore((state) => state.brandDisputesDirty);
  const clearBrandDisputesDirty = useStore((state) => state.clearBrandDisputesDirty);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | unresolved | resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);

      const query = supabase
        .from('support_tickets')
        .select(
          'id, user_id, ticket_type, order_id_text, description, screenshot_url, status, created_at, order_issue_reason, brand_done',
        )
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.warn('BrandDisputes: error loading tickets', error.message || error);
        setTickets([]);
        return;
      }

      let mapped = Array.isArray(data)
        ? data
            // Only disputes relevant to sellers: vendor disputes or order issues
            .filter((t) => !t.ticket_type || t.ticket_type === 'vendor_dispute' || t.ticket_type === 'order_issue')
            // Show to seller once admin has approved (status = resolved)
            .filter((t) => (t.status || 'open') === 'resolved')
            .map((t) => {
              const created = t.created_at ? new Date(t.created_at) : null;
              return {
                id: t.id,
                userId: t.user_id,
                type: t.ticket_type,
                orderIdText: t.order_id_text,
                description: t.description,
                screenshotUrl: t.screenshot_url,
                status: t.status || 'open',
                createdAt: created,
                createdAtLabel: created ? created.toLocaleString() : 'Unknown',
                orderIssueReason: t.order_issue_reason || null,
                brandDone: !!t.brand_done,
                productName: 'Order Item',
                productImageUrl: null,
              };
            })
        : [];

      const orderIds = mapped
        .map((t) => (t.orderIdText ? Number(t.orderIdText) : null))
        .filter((id) => Number.isFinite(id));

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, name, image_url, brand_user_id')
          .in('order_id', orderIds);

        if (!itemsError && Array.isArray(itemsData)) {
          const byOrderId = new Map();
          itemsData.forEach((row) => {
            if (!row || !Number.isFinite(row.order_id)) return;
            // Only consider items that belong to the current brand user
            if (!row.brand_user_id || row.brand_user_id !== authUserId) return;
            if (!byOrderId.has(row.order_id)) {
              byOrderId.set(row.order_id, row);
            }
          });

          mapped = mapped
            // Keep only tickets whose order has an item for this brand
            .filter((ticket) => {
              const orderId = ticket.orderIdText ? Number(ticket.orderIdText) : null;
              return orderId && byOrderId.has(orderId);
            })
            .map((ticket) => {
              const orderId = ticket.orderIdText ? Number(ticket.orderIdText) : null;
              const item = orderId && byOrderId.get(orderId);
              return item
                ? {
                    ...ticket,
                    productName: item.name || ticket.productName,
                    productImageUrl: item.image_url || ticket.productImageUrl,
                  }
                : ticket;
            });
        }
      }

      setTickets(mapped);
    } catch (e) {
      console.warn('BrandDisputes: exception loading tickets', e.message || e);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets]),
  );

  React.useEffect(() => {
    if (!brandDisputesDirty) return;
    loadTickets();
    clearBrandDisputesDirty();
  }, [brandDisputesDirty, loadTickets, clearBrandDisputesDirty]);

  const filteredTickets = useMemo(() => {
    let list = tickets;

    // For the brand:
    // - "Unresolved" = admin resolved but brand has NOT marked done (brandDone === false)
    // - "Resolved" = brand has finished handling (brandDone === true)
    if (statusFilter === 'unresolved') {
      list = list.filter((t) => t.status === 'resolved' && !t.brandDone);
    } else if (statusFilter === 'resolved') {
      list = list.filter((t) => t.status === 'resolved' && t.brandDone);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => {
        return (
          (t.orderIdText && t.orderIdText.toLowerCase().includes(q)) ||
          (t.productName && t.productName.toLowerCase().includes(q)) ||
          String(t.id).toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [tickets, statusFilter, searchQuery]);

  const renderStatusPill = (ticket) => {
    const status = ticket.status || 'open';

    let label = STATUS_LABELS[status] || 'Unresolved';
    if (status === 'resolved') {
      label = ticket.brandDone ? 'Done' : 'Pending action';
    }
    const pillStyle =
      status === 'resolved'
        ? styles.statusPillResolved
        : status === 'in_review'
        ? styles.statusPillReview
        : styles.statusPillUnresolved;

    return (
      <View style={[styles.statusPill, pillStyle]}>
        <Text style={styles.statusPillText}>{label}</Text>
      </View>
    );
  };

  const handleUpdateStatus = async (ticket) => {
    if (!ticket || !ticket.id || updatingTicketId) return;

    const current = ticket.status || 'open';
    let nextStatus = current;

    if (current === 'open') nextStatus = 'in_review';
    else if (current === 'in_review') nextStatus = 'resolved';
    else if (current === 'resolved') nextStatus = 'resolved';

    if (nextStatus === current) return;

    try {
      setUpdatingTicketId(ticket.id);

      const { error } = await supabase
        .from('support_tickets')
        .update({ status: nextStatus })
        .eq('id', ticket.id);

      if (error) {
        console.warn('BrandDisputes: error updating status', error.message || error);
        return;
      }

      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: nextStatus } : t)),
      );
    } catch (e) {
      console.warn('BrandDisputes: exception updating status', e.message || e);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // Brand "Done" action: when admin has resolved the ticket, brand taps this once
  // to mark that they've handled it (e.g. will reorder / pass to staff).
  // We keep status = "resolved" and set brand_done = true in Supabase.
  const handleMarkResolved = async (ticket) => {
    if (!ticket || !ticket.id || updatingTicketId) return;

    const currentStatus = ticket.status || 'open';
    if (currentStatus !== 'resolved') return; // Only allow brand to finalize admin-resolved tickets

    try {
      setUpdatingTicketId(ticket.id);

      const { error } = await supabase
        .from('support_tickets')
        .update({ brand_done: true })
        .eq('id', ticket.id);

      if (error) {
        console.warn('BrandDisputes: error marking done', error.message || error);
        return;
      }

      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, brandDone: true } : t)),
      );
    } catch (e) {
      console.warn('BrandDisputes: exception marking done', e.message || e);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const renderIssueLabel = (ticket) => {
    let label = 'Issue';
    if (ticket.type === 'vendor_dispute') label = 'Vendor Dispute';
    else if (ticket.type === 'order_issue')
      label = ticket.orderIssueReason ? `Order Issue – ${ticket.orderIssueReason}` : 'Order Issue';

    return (
      <View style={styles.issueRow}>
        <Text style={styles.issueIcon}>!</Text>
        <Text style={styles.issueText}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disputes & Support</Text>
        <TouchableOpacity style={styles.headerIconButton}>
          <Bell size={20} color="#111827" />
          {filteredTickets.some((t) => t.status !== 'resolved') && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {filteredTickets.filter((t) => t.status !== 'resolved').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search + filter bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            placeholder="Search item or order ID"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Status chips */}
      <View style={styles.chipRow}>
        {[
          { id: 'all', label: 'All' },
          { id: 'unresolved', label: 'Unresolved' },
          { id: 'resolved', label: 'Resolved' },
        ].map((chip) => {
          const active = statusFilter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatusFilter(chip.id)}
            >
              <Text style={active ? styles.chipTextActive : styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading && tickets.length === 0 ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#11126F" />
        </View>
      ) : filteredTickets.length === 0 ? (
        <View style={styles.loadingWrapper}>
          <Text style={styles.emptyText}>No disputes found for this filter.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredTickets.map((ticket) => (
            <View key={ticket.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.orderLabel}>ORDER #{ticket.orderIdText || ticket.id}</Text>
                </View>
                {renderStatusPill(ticket)}
              </View>

              <View style={styles.cardBodyRow}>
                {ticket.productImageUrl ? (
                  <Image
                    source={{ uri: ticket.productImageUrl }}
                    style={styles.productImage}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                ) : (
                  <View style={styles.productImageFallback}>
                    <Text style={styles.productImageFallbackText}>
                      {(ticket.productName || 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.cardBodyTextCol}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {ticket.productName}
                  </Text>
                  <Text style={styles.productMeta} numberOfLines={1}>
                    {ticket.orderIdText ? `Related to order ${ticket.orderIdText}` : 'Customer dispute'}
                  </Text>
                  {renderIssueLabel(ticket)}
                </View>
              </View>

              {ticket.description ? (
                <View style={styles.requestBox}>
                  <Text style={styles.requestLabel}>Customer request</Text>
                  <Text style={styles.requestText} numberOfLines={3}>
                    {ticket.description}
                  </Text>
                </View>
              ) : null}

              {ticket.screenshotUrl ? (
                <View style={styles.requestBox}>
                  <Text style={styles.requestLabel}>Screenshot</Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setSelectedScreenshotUrl(ticket.screenshotUrl);
                      setScreenshotModalVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: ticket.screenshotUrl }}
                      style={styles.screenshotImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={150}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleUpdateStatus(ticket)}
                  disabled={!!updatingTicketId}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>Update Status</Text>
                </TouchableOpacity>
                {ticket.status === 'resolved' && !ticket.brandDone ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => handleMarkResolved(ticket)}
                    disabled={!!updatingTicketId}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </TouchableOpacity>
                ) : ticket.status === 'resolved' && ticket.brandDone ? (
                  <View style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <Modal
        visible={!!screenshotModalVisible && !!selectedScreenshotUrl}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setScreenshotModalVisible(false);
          setSelectedScreenshotUrl(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Screenshot</Text>
            {selectedScreenshotUrl ? (
              <Image
                source={{ uri: selectedScreenshotUrl }}
                style={styles.modalImage}
                contentFit="contain"
                cachePolicy="disk"
              />
            ) : null}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setScreenshotModalVisible(false);
                  setSelectedScreenshotUrl(null);
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5FB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInputWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  searchInput: {
    fontSize: 14,
    color: '#111827',
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#11126F',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#11126F',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#11126F',
  },
  chipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillUnresolved: {
    backgroundColor: '#FEF2F2',
  },
  statusPillReview: {
    backgroundColor: '#DBEAFE',
  },
  statusPillResolved: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  productImageFallback: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageFallbackText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  cardBodyTextCol: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  productMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  issueIcon: {
    width: 16,
    height: 16,
    borderRadius: 999,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    marginRight: 4,
    color: '#B91C1C',
  },
  issueText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
  },
  requestBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  requestLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  requestText: {
    fontSize: 13,
    color: '#111827',
  },
  screenshotImage: {
    marginTop: 8,
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#11126F',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#11126F',
  },
  primaryButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11126F',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
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
});

export default BrandDisputesScreen;
