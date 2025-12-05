import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

const FlashSaleScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);

  const loadFlashProducts = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .not('flash_price', 'is', null)
        .lte('flash_start_at', nowIso)
        .gt('flash_end_at', nowIso);

      if (error) {
        console.warn('Error loading flash sale products', error.message || error);
        return;
      }

      let list = Array.isArray(data) ? data : [];
      list = list.filter((p) => {
        if (p.flash_quantity == null) return true;
        const sold = Number(p.flash_sold) || 0;
        return sold < p.flash_quantity;
      });

      setItems(list);
    } catch (e) {
      console.warn('Error loading flash sale products', e.message || e);
    }
  }, []);

  useEffect(() => {
    loadFlashProducts();
  }, [loadFlashProducts]);

  useFocusEffect(
    useCallback(() => {
      loadFlashProducts();
    }, [loadFlashProducts]),
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const renderItem = ({ item }) => {
    const end = item.flash_end_at ? new Date(item.flash_end_at).getTime() : 0;
    const remainingMs = Math.max(end - now, 0);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const sold = Number(item.flash_sold) || 0;
    const qty = item.flash_quantity;
    const isSoldOut = qty != null && sold >= qty;
    const leftText = qty != null ? `${Math.max(qty - sold, 0)} / ${qty} left` : `Sold: ${sold}`;

    const flashPrice = Number(item.flash_price) || 0;
    const originalPrice = Number(item.price) || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
      >
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.brand}>{item.brand}</Text>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.priceRow}>
            {originalPrice > 0 && (
              <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.flashPrice}>${flashPrice.toFixed(2)}</Text>
          </View>
          <Text style={styles.leftText}>{leftText}</Text>
          <Text style={styles.countdown}>
            {hours.toString().padStart(2, '0')}:
            {minutes.toString().padStart(2, '0')}:
            {seconds.toString().padStart(2, '0')}
          </Text>
        </View>
        {isSoldOut && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Flash Sale</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 && styles.emptyList}
        ListEmptyComponent={<Text style={styles.emptyText}>No flash sales active right now.</Text>}
      />
    </SafeAreaView>
  );
};

export default FlashSaleScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  brand: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  flashPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  leftText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  countdown: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
