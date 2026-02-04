import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  resolved: 'Resolved',
};

const AdminSupportTicketsScreen = ({ navigation }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, user_id, ticket_type, order_id_text, description, screenshot_url, status, created_at, order_issue_reason')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('AdminSupportTickets: error loading tickets', error.message || error);
        setTickets([]);
        return;
      }

      let mapped = Array.isArray(data)
        ? data.map((t) => {
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
              productName: null,
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
          .select('order_id, name, image_url')
          .in('order_id', orderIds);

        if (!itemsError && Array.isArray(itemsData)) {
          const byOrderId = new Map();
          itemsData.forEach((row) => {
            if (!row || !Number.isFinite(row.order_id)) return;
            if (!byOrderId.has(row.order_id)) {
              byOrderId.set(row.order_id, row);
            }
          });

          mapped = mapped.map((ticket) => {
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
      console.warn('AdminSupportTickets: exception loading tickets', e.message || e);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets]),
  );

  const summary = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'open').length;
    const resolved = tickets.filter((t) => t.status === 'resolved').length;
    return { total, open, resolved };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (filterStatus === 'all') return tickets;
    return tickets.filter((t) => t.status === filterStatus);
  }, [tickets, filterStatus]);

  const renderTicket = ({ item }) => {
    const statusLabel = STATUS_LABELS[item.status] || item.status || 'Open';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate('AdminSupportTicketDetails', {
            ticketId: item.id,
          })
        }
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.ticketBadgeWrapper}>
            <View style={styles.ticketBadgeCircle}>
              <Text style={styles.ticketBadgeText}>{item.type ? item.type[0].toUpperCase() : 'T'}</Text>
            </View>
            <View style={styles.cardHeaderTextBlock}>
              <Text style={styles.ticketTypeText} numberOfLines={1}>
                {item.type === 'order_issue'
                  ? 'Order Issue'
                  : item.type === 'technical_glitch'
                  ? 'Technical Glitch'
                  : item.type === 'vendor_dispute'
                  ? 'Vendor Dispute'
                  : item.type || 'Ticket'}
              </Text>
              <Text style={styles.ticketMetaText} numberOfLines={1}>
                ID: {item.id} · User: {item.userId}
              </Text>
              {item.type === 'order_issue' && item.orderIssueReason ? (
                <Text style={styles.ticketMetaText} numberOfLines={1}>
                  Issue: {item.orderIssueReason}
                </Text>
              ) : null}
              {item.productName ? (
                <Text style={styles.ticketMetaText} numberOfLines={1}>
                  Item: {item.productName}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.statusPillWrapper}>
            <Text
              style={[
                styles.statusPill,
                item.status === 'resolved' && styles.statusPillResolved,
                item.status === 'in_review' && styles.statusPillReview,
                item.status === 'open' && styles.statusPillOpen,
              ]}
            >
              {statusLabel}
            </Text>
            <Text style={styles.ticketDateText}>{item.createdAtLabel}</Text>
          </View>
        </View>

        {item.orderIdText ? (
          <Text style={styles.ticketOrderText} numberOfLines={1}>
            Related order: {item.orderIdText}
          </Text>
        ) : null}

        {item.description ? (
          <Text style={styles.ticketDescription} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        {item.screenshotUrl ? (
          <Text style={styles.ticketAttachmentHint} numberOfLines={1}>
            Screenshot attached
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Reports</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <Text style={styles.summaryLabel}>Total Tickets</Text>
          <Text style={styles.summaryValue}>{summary.total}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSoft]}>
          <Text style={styles.summaryLabel}>Open</Text>
          <Text style={styles.summaryValue}>{summary.open}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardAccent]}>
          <Text style={styles.summaryLabel}>Resolved</Text>
          <Text style={styles.summaryValue}>{summary.resolved}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Open' },
            { id: 'in_review', label: 'In Review' },
            { id: 'resolved', label: 'Resolved' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.chip,
                filterStatus === opt.id && styles.chipActive,
              ]}
              onPress={() => setFilterStatus(opt.id)}
            >
              <Text
                style={
                  filterStatus === opt.id
                    ? styles.chipTextActive
                    : styles.chipText
                }
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && filteredTickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTicket}
          contentContainerStyle={
            filteredTickets.length === 0
              ? styles.emptyContainer
              : { paddingBottom: 24 }
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tickets match your filters.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminSupportTicketsScreen;

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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryCardPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#1d4ed8',
    color: '#ffffff',
  },
  summaryCardSoft: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  summaryCardAccent: {
    backgroundColor: '#ECFDF3',
    borderColor: '#BBF7D0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    color: '#111827',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  chipTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  ticketBadgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ticketBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cardHeaderTextBlock: {
    flex: 1,
  },
  ticketTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  ticketMetaText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusPillWrapper: {
    alignItems: 'flex-end',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  statusPillOpen: {
    backgroundColor: '#FEF3C7',
  },
  statusPillReview: {
    backgroundColor: '#DBEAFE',
  },
  statusPillResolved: {
    backgroundColor: '#DCFCE7',
  },
  ticketDateText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  ticketOrderText: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4,
  },
  ticketDescription: {
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
  },
  ticketAttachmentHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
