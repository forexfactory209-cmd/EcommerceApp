import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const PromoCodesScreen = () => {
  const authUserId = useStore((state) => state.authUserId);

  const [promoCodeText, setPromoCodeText] = useState('');
  const [promoAmountInput, setPromoAmountInput] = useState('');
  const [promoExpiryInput, setPromoExpiryInput] = useState(''); // YYYY-MM-DD
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [promoList, setPromoList] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [copiedPromoId, setCopiedPromoId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadPromos = async () => {
        if (!authUserId) return;

        try {
          setPromoLoading(true);
          const { data: promoRows, error: promoError } = await supabase
            .from('promo_codes')
            .select('id, code, discount_percentage, is_active, expires_at, created_at')
            .eq('brand_user_id', authUserId)
            .order('created_at', { ascending: false });

          if (promoError) {
            console.warn('PromoCodes: failed to load promo codes', promoError.message || promoError);
          } else if (isActive && Array.isArray(promoRows)) {
            setPromoList(promoRows);
          }
        } catch (e) {
          console.warn('PromoCodes: unexpected error loading promo codes', e.message || e);
        } finally {
          if (isActive) setPromoLoading(false);
        }
      };

      loadPromos();

      return () => {
        isActive = false;
      };
    }, [authUserId]),
  );

  const handleCreatePromoCode = async () => {
    if (!authUserId) return;

    const codeRaw = (promoCodeText || '').trim();
    const amountRaw = (promoAmountInput || '').trim();
    const expiryRaw = (promoExpiryInput || '').trim();

    if (!codeRaw || !amountRaw) {
      return;
    }

    const discountValue = parseFloat(amountRaw.replace(/[^0-9.]/g, ''));
    if (!discountValue || discountValue <= 0 || discountValue >= 100) {
      return;
    }

    try {
      setCreatingPromo(true);

      const normalizedCode = codeRaw.toUpperCase();

      let expiresAt = null;
      if (expiryRaw) {
        // Expecting YYYY-MM-DD; let Supabase parse it
        expiresAt = expiryRaw;
      }

      const { error } = await supabase.from('promo_codes').insert([
        {
          code: normalizedCode,
          brand_user_id: authUserId,
          discount_percentage: discountValue,
          is_active: true,
          expires_at: expiresAt,
        },
      ]);

      if (error) {
        console.warn('PromoCodes: failed to create promo code', error.message || error);
        return;
      }

      setPromoCodeText('');
      setPromoAmountInput('');
      setPromoExpiryInput('');

      // Refresh list
      try {
        const { data: promoRows, error: promoError } = await supabase
          .from('promo_codes')
          .select('id, code, discount_percentage, is_active, expires_at, created_at')
          .eq('brand_user_id', authUserId)
          .order('created_at', { ascending: false });

        if (promoError) {
          console.warn('PromoCodes: failed to reload promo list', promoError.message || promoError);
        } else if (Array.isArray(promoRows)) {
          setPromoList(promoRows);
        }
      } catch (reloadErr) {
        console.warn('PromoCodes: exception reloading promo list', reloadErr.message || reloadErr);
      }
    } catch (e) {
      console.warn('PromoCodes: unexpected error creating promo code', e.message || e);
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleDeactivatePromoCode = async (promoId) => {
    if (!promoId) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: false })
        .eq('id', promoId);

      if (error) {
        console.warn('PromoCodes: failed to deactivate promo code', error.message || error);
        return;
      }

      setPromoList((current) =>
        Array.isArray(current)
          ? current.map((p) => (p.id === promoId ? { ...p, is_active: false } : p))
          : current,
      );
    } catch (e) {
      console.warn('PromoCodes: exception deactivating promo code', e.message || e);
    }
  };

  const handleCopyCode = async (promoId, code) => {
    if (!code) return;
    try {
      Clipboard.setString(code);
      setCopiedPromoId(promoId);
      setTimeout(() => {
        setCopiedPromoId((current) => (current === promoId ? null : current));
      }, 1500);
    } catch (e) {
      console.warn('PromoCodes: failed to copy code', e.message || e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Promo Codes</Text>

        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Create Promo Code</Text>
          <Text style={styles.promoSubtitle}>
            Share codes with your customers. They will be valid only for orders from your brand.
          </Text>
          <View style={styles.promoInputsRow}>
            <TextInput
              style={styles.promoCodeInput}
              placeholder="CODE"
              autoCapitalize="characters"
              value={promoCodeText}
              onChangeText={setPromoCodeText}
            />
            <TextInput
              style={styles.promoAmountInput}
              placeholder="% off (e.g. 10)"
              keyboardType="numeric"
              value={promoAmountInput}
              onChangeText={setPromoAmountInput}
            />
          </View>
          <TextInput
            style={styles.promoExpiryInput}
            placeholder="Expiry date (YYYY-MM-DD)"
            value={promoExpiryInput}
            onChangeText={setPromoExpiryInput}
          />
          <TouchableOpacity
            style={styles.promoCreateButton}
            onPress={handleCreatePromoCode}
            disabled={creatingPromo}
          >
            <Text style={styles.promoCreateButtonText}>
              {creatingPromo ? 'Creating...' : 'Generate Promo Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.promoListCard}>
          <Text style={styles.promoListTitle}>My Promo Codes</Text>
          {promoLoading && <Text style={styles.promoListHelper}>Loading promo codes...</Text>}
          {!promoLoading && (!promoList || promoList.length === 0) && (
            <Text style={styles.promoListHelper}>You have not created any promo codes yet.</Text>
          )}
          {!promoLoading && Array.isArray(promoList) && promoList.length > 0 && (
            <View style={styles.promoListItems}>
              {promoList.map((promo) => {
                const isActive = promo.is_active;
                const amount = Number(promo.discount_percentage) || 0;
                let expiryLabel = 'No expiry';
                if (promo.expires_at) {
                  try {
                    const d = new Date(promo.expires_at);
                    if (!Number.isNaN(d.getTime())) {
                      expiryLabel = d.toLocaleDateString();
                    }
                  } catch {}
                }

                return (
                  <View key={promo.id} style={styles.promoListItemRow}>
                    <View style={styles.promoListItemLeft}>
                      <Text style={styles.promoListCode}>{promo.code}</Text>
                      <Text style={styles.promoListMeta}>
                        {amount.toFixed(0)}% off · Expires: {expiryLabel}
                      </Text>
                    </View>
                    <View style={styles.promoListItemRight}>
                      <Text style={isActive ? styles.promoStatusActive : styles.promoStatusInactive}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Text>
                      <View style={styles.promoListActionsRow}>
                        <TouchableOpacity
                          style={styles.promoCopyButton}
                          onPress={() => handleCopyCode(promo.id, promo.code)}
                        >
                          <Text style={styles.promoCopyButtonText}>
                            {copiedPromoId === promo.id ? 'Copied' : 'Copy'}
                          </Text>
                        </TouchableOpacity>
                        {isActive && (
                          <TouchableOpacity
                            style={styles.promoDeactivateButton}
                            onPress={() => handleDeactivatePromoCode(promo.id)}
                          >
                            <Text style={styles.promoDeactivateButtonText}>Deactivate</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PromoCodesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 16,
  },
  promoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  promoInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 8,
  },
  promoAmountInput: {
    width: 100,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  promoExpiryInput: {
    marginTop: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  promoCreateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  promoCreateButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  promoListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  promoListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  promoListHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
  promoListItems: {
    marginTop: 6,
  },
  promoListItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  promoListItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  promoListItemRight: {
    alignItems: 'flex-end',
  },
  promoListCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  promoListMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  promoStatusActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  promoStatusInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 4,
  },
  promoListActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoCopyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
  },
  promoCopyButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  promoDeactivateButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  promoDeactivateButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
});
