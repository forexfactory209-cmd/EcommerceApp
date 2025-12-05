import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, X } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import { sendAnnouncementToFollowers } from '../services/notifications';

const CreateAnnouncementScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { brandId } = route.params || {};
  const authUserId = useStore((state) => state.authUserId);
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Load follower count
  useEffect(() => {
    const loadFollowerCount = async () => {
      if (!brandId) {
        console.log('[CreateAnnouncement] No brandId provided');
        return;
      }
      
      console.log('[CreateAnnouncement] Loading follower count for brandId:', brandId);
      
      try {
        console.log('[CreateAnnouncement] Querying brand_follows for brandId:', brandId, typeof brandId);
        
        const { count, error } = await supabase
          .from('brand_follows')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brandId);
          
        if (error) {
          console.error('[CreateAnnouncement] Error querying brand_follows:', error);
          throw error;
        }
        console.log('[CreateAnnouncement] Follower count result:', count);
        setFollowerCount(count || 0);

        // Debug: list all follows for this brand
        const { data: follows, error: followsError } = await supabase
          .from('brand_follows')
          .select('*')
          .eq('brand_id', brandId);
        console.log('[CreateAnnouncement] Debug follows list:', follows, followsError);

        // Debug: check if brand_follows table exists
        try {
          const { data: tableTest, error: tableError } = await supabase
            .from('brand_follows')
            .select('*')
            .limit(1);
          console.log('[CreateAnnouncement] Table existence test:', tableTest, tableError);
        } catch (e) {
          console.error('[CreateAnnouncement] Table test error:', e);
        }

        // Debug: check all brand_follows entries with details
        const { data: allFollows, error: allFollowsError } = await supabase
          .from('brand_follows')
          .select('*')
          .limit(10);
        console.log('[CreateAnnouncement] All brand_follows (first 10):', allFollows, allFollowsError);
        
        // Debug: check what brand_id we're looking for vs what's in the table
        if (allFollows && allFollows.length > 0) {
          console.log('[CreateAnnouncement] Looking for brandId:', brandId, typeof brandId);
          console.log('[CreateAnnouncement] Available brand_ids in table:');
          allFollows.forEach((follow, index) => {
            console.log(`  [${index}] brand_id:`, follow.brand_id, typeof follow.brand_id);
          });
        }
        
        // Debug: also check the brands table to see what brand IDs exist
        const { data: brands, error: brandsError } = await supabase
          .from('brands')
          .select('id, name, user_id')
          .limit(10);
        console.log('[CreateAnnouncement] Brands in table:', brands, brandsError);
        
        // Debug: check if our brandId matches any brand in the brands table
        if (brands) {
          const matchingBrand = brands.find(b => b.id === brandId);
          console.log('[CreateAnnouncement] Matching brand for our brandId:', matchingBrand);
        }
      } catch (error) {
        console.error('Error loading follower count:', error);
      }
    };
    
    loadFollowerCount();
  }, [brandId]);

  const handleSendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (followerCount === 0) {
      Alert.alert('No Followers', 'You currently have no followers to send announcements to.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log('[CreateAnnouncement] About to send announcement with brandId:', brandId, typeof brandId);
      const sentCount = await sendAnnouncementToFollowers(
        brandId,
        title.trim(),
        message.trim()
      );

      // Navigate to a success screen tailored for announcements
      navigation.navigate('Success', {
        type: 'announcement',
        title: 'Announcement Sent',
        message: `Your announcement has been sent to ${sentCount} follower${sentCount !== 1 ? 's' : ''}.`,
      });
      
    } catch (error) {
      console.error('Error sending announcement:', error);
      Alert.alert('Error', 'Failed to send announcement. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Announcement</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.followerCountContainer}>
          <Text style={styles.followerCountText}>
            This will be sent to {followerCount} follower{followerCount !== 1 ? 's' : ''}
          </Text>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Announcement title"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            editable={!isLoading}
          />
          <View style={styles.charCount}>
            <Text style={styles.charCountText}>
              {title.length}/100
            </Text>
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Write your announcement here..."
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
            editable={!isLoading}
          />
          <View style={styles.charCount}>
            <Text style={styles.charCountText}>
              {message.length}/500
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (isLoading || !title.trim() || !message.trim()) && styles.sendButtonDisabled
          ]}
          onPress={handleSendAnnouncement}
          disabled={isLoading || !title.trim() || !message.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={18} color="#fff" style={styles.sendIcon} />
              <Text style={styles.sendButtonText}>
                Send to {followerCount} follower{followerCount !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    width: 40, // Same as back button for balance
  },
  content: {
    flexGrow: 1,
    padding: 16,
  },
  followerCountContainer: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  followerCountText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  messageInput: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  charCountText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  sendIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateAnnouncementScreen;
