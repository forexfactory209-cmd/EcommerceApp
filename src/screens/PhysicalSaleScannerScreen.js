import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import { X, CheckCircle, Package, TrendingUp, Minus, Plus } from 'lucide-react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const PhysicalSaleScannerScreen = ({ navigation }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const authUserId = useStore((state) => state.authUserId);

    const scaleAnim = new Animated.Value(0);
    const fadeAnim = new Animated.Value(0);

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getCameraPermissions();
    }, []);

    const handleBarCodeScanned = async ({ type, data }) => {
        if (scanned) return;

        setScanned(true);
        setLoading(true);

        try {
            // Extract product ID from QR code data
            // Expected format: "ecommerceapp://product/{product_id}"
            const productId = data.replace('ecommerceapp://product/', '');

            // Fetch product details
            const { data: productData, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (productError || !productData) {
                Alert.alert('Error', 'Product not found or invalid QR code');
                setScanned(false);
                setLoading(false);
                return;
            }

            // Check if this product belongs to the current seller
            if (productData.brand_user_id !== authUserId) {
                Alert.alert('Error', 'This product does not belong to your store');
                setScanned(false);
                setLoading(false);
                return;
            }

            // Fetch variants for this product
            const { data: variantsData, error: variantsError } = await supabase
                .from('variants')
                .select('*')
                .eq('product_id', productId)
                .order('size', { ascending: true });

            if (variantsError) {
                console.warn('Error fetching variants:', variantsError);
            }

            setProduct(productData);
            setVariants(variantsData || []);
            setShowProductModal(true);
            setLoading(false);
        } catch (error) {
            console.error('Error processing QR code:', error);
            Alert.alert('Error', 'Failed to process QR code');
            setScanned(false);
            setLoading(false);
        }
    };

    const [selectedVariant, setSelectedVariant] = useState(null);
    const [saleQuantity, setSaleQuantity] = useState(1);

    const handleConfirmSale = async () => {
        // Case 1: Product with variants (Size selected)
        if (variants.length > 0) {
            if (!selectedVariant) {
                Alert.alert('Select Size', 'Please select a size to deduct.');
                return;
            }
            if (selectedVariant.stock_quantity < saleQuantity) {
                Alert.alert('Insufficient Stock', `Only ${selectedVariant.stock_quantity} available.`);
                return;
            }
            await executeVariantDeduct(selectedVariant);
        }
        // Case 2: Product without variants (Direct deduct)
        else {
            const currentQty = product.quantity || 0;
            if (currentQty < saleQuantity) {
                Alert.alert('Insufficient Stock', `Only ${currentQty} available.`);
                return;
            }
            await executeProductDeduct();
        }
    };

    const executeVariantDeduct = async (variant) => {
        try {
            setLoading(true);
            const { data: result, error } = await supabase.rpc('deduct_stock', {
                target_variant_id: variant.id,
                deduct_amount: saleQuantity
            });

            if (error) throw error;
            if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to deduct stock');
                setLoading(false);
                return;
            }

            await supabase.from('sales_history').insert([{
                seller_id: authUserId,
                product_id: product.id,
                variant_id: variant.id,
                size: variant.size,
                sale_type: 'physical',
                quantity: saleQuantity
            }]);

            const points = 10 * saleQuantity;
            await supabase.rpc('award_trust_points', { user_id: authUserId, points });

            setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, stock_quantity: result.current_stock } : v));

            prepareSuccessModal({
                productName: product.name,
                size: variant.size,
                previousStock: result.previous_stock,
                currentStock: result.current_stock,
                trustPoints: points
            });
        } catch (error) {
            console.error('Error deducting stock:', error);
            Alert.alert('Error', error.message || 'Failed to update stock');
            setLoading(false);
        }
    };

    const executeProductDeduct = async () => {
        try {
            setLoading(true);
            const { data: result, error } = await supabase.rpc('deduct_product_stock', {
                target_product_id: product.id,
                deduct_amount: saleQuantity
            });

            if (error) throw error;
            if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to deduct stock');
                setLoading(false);
                return;
            }

            await supabase.from('sales_history').insert([{
                seller_id: authUserId,
                product_id: product.id,
                variant_id: null,
                size: null,
                sale_type: 'physical',
                quantity: saleQuantity
            }]);

            const points = 10 * saleQuantity;
            await supabase.rpc('award_trust_points', { user_id: authUserId, points });

            setProduct(prev => ({ ...prev, quantity: result.current_stock }));

            prepareSuccessModal({
                productName: product.name,
                size: 'Standard',
                previousStock: result.previous_stock,
                currentStock: result.current_stock,
                trustPoints: points
            });
        } catch (error) {
            console.error('Error deducting product stock:', error);
            Alert.alert('Error', error.message || 'Failed to update stock');
            setLoading(false);
        }
    };

    const prepareSuccessModal = (data) => {
        setSuccessData(data);
        setShowProductModal(false);
        // Force a small delay to ensure modal switch is clean or immediate
        setTimeout(() => {
            setShowSuccessModal(true);
        }, 50);
        setLoading(false);
    };

    const handleDone = () => {
        // Reset state
        setShowSuccessModal(false);
        setProduct(null);
        setVariants([]);
        setSuccessData(null);
        setSelectedVariant(null);
        setSaleQuantity(1);
        setScanned(false);
        scaleAnim.setValue(0);
        fadeAnim.setValue(0);

        // Navigate back to Home Dashboard (Main Tab Navigator)
        navigation.navigate('Main');
    };

    const handleBackToScanner = () => {
        setShowSuccessModal(false);
        setProduct(null);
        setVariants([]);
        setSuccessData(null);
        setSelectedVariant(null);
        setSaleQuantity(1);
        setScanned(false);
        scaleAnim.setValue(0);
        fadeAnim.setValue(0);
    };

    if (hasPermission === null) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#090966" />
            </SafeAreaView>
        );
    }

    if (hasPermission === false) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>Camera permission is required to scan QR codes</Text>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={() => Camera.requestCameraPermissionsAsync()}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Product QR</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Camera View */}
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />

                {/* Scanning Frame */}
                <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsText}>
                        Point camera at product QR code
                    </Text>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            )}

            {/* Product Selection Modal */}
            <Modal
                visible={showProductModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowProductModal(false);
                    setScanned(false);
                }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.productModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Quick Deduct</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowProductModal(false);
                                    setScanned(false);
                                }}
                            >
                                <X size={24} color="#1f2937" />
                            </TouchableOpacity>
                        </View>

                        {product && (
                            <>
                                {/* Product Info */}
                                <View style={styles.productInfo}>
                                    <Image
                                        source={{ uri: product.image || product.image_full_url }}
                                        style={styles.productImage}
                                        contentFit="cover"
                                    />
                                    <View style={styles.productDetails}>
                                        <Text style={styles.productName}>{product.name}</Text>
                                        <Text style={styles.productBrand}>{product.brand}</Text>
                                        <Text style={styles.productPrice}>${Number(product.price).toFixed(2)}</Text>
                                    </View>
                                </View>

                                {/* Size Selection or Direct Deduct */}
                                {variants.length > 0 ? (
                                    <>
                                        <Text style={styles.sizeLabel}>Select Size:</Text>
                                        <View style={styles.sizesContainer}>
                                            {variants.map((variant) => (
                                                <TouchableOpacity
                                                    key={variant.id}
                                                    style={[
                                                        styles.sizeButton,
                                                        variant.stock_quantity <= 0 && styles.sizeButtonDisabled,
                                                        selectedVariant?.id === variant.id && styles.selectedSizeButton
                                                    ]}
                                                    onPress={() => setSelectedVariant(variant)}
                                                    disabled={variant.stock_quantity <= 0 || loading}
                                                >
                                                    <Text style={[
                                                        styles.sizeButtonText,
                                                        variant.stock_quantity <= 0 && styles.sizeButtonTextDisabled,
                                                        selectedVariant?.id === variant.id && { color: '#090966' }
                                                    ]}>
                                                        {variant.size}
                                                    </Text>
                                                    <Text style={[
                                                        styles.stockText,
                                                        variant.stock_quantity <= 0 && styles.stockTextDisabled
                                                    ]}>
                                                        {variant.stock_quantity} left
                                                    </Text>
                                                    {selectedVariant?.id === variant.id && (
                                                        <View style={[styles.minusButton, { backgroundColor: '#090966' }]}>
                                                            <CheckCircle size={20} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                                        <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 8 }}>
                                            Current Stock: {product.quantity || 0}
                                        </Text>
                                    </View>
                                )}

                                {/* Quantity Selector - Common for both */}
                                <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
                                        Select Quantity to Deduct:
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity
                                            onPress={() => setSaleQuantity(Math.max(1, saleQuantity - 1))}
                                            style={styles.qtyButton}
                                        >
                                            <Minus size={20} color="#090966" />
                                        </TouchableOpacity>

                                        <Text style={styles.qtyText}>{saleQuantity}</Text>

                                        <TouchableOpacity
                                            onPress={() => setSaleQuantity(saleQuantity + 1)}
                                            style={styles.qtyButton}
                                        >
                                            <Plus size={20} color="#090966" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Confirm Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.confirmButton,
                                        (loading || (variants.length > 0 && !selectedVariant)) && styles.confirmButtonDisabled
                                    ]}
                                    onPress={handleConfirmSale}
                                    disabled={loading || (variants.length > 0 && !selectedVariant)}
                                >
                                    <Text style={styles.confirmButtonText}>
                                        {loading ? 'Processing...' : `Confirm Sale (${saleQuantity})`}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Success Modal - Centered Card Design */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={handleDone}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                    <View
                        style={{
                            width: '85%',
                            maxWidth: 360,
                            backgroundColor: '#ffffff',
                            borderRadius: 24,
                            padding: 24,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.25,
                            shadowRadius: 10,
                            elevation: 10
                        }}
                    >
                        {/* Success Icon */}
                        <View
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                backgroundColor: '#DCFCE7',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16
                            }}
                        >
                            <CheckCircle size={48} color="#16A34A" strokeWidth={3} />
                        </View>

                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
                            Sale Recorded!
                        </Text>

                        {successData?.size && successData.size !== 'Standard' && (
                            <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 4 }}>
                                Size: <Text style={{ fontWeight: '600', color: '#374151' }}>{successData.size}</Text>
                            </Text>
                        )}

                        {/* Stock Update Visualization */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#F3F4F6',
                            borderRadius: 16,
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                            marginVertical: 20,
                            width: '100%'
                        }}>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>WAS</Text>
                                <Text style={{ fontSize: 20, fontWeight: '600', color: '#9CA3AF', textDecorationLine: 'line-through' }}>
                                    {successData?.previousStock}
                                </Text>
                            </View>

                            <View style={{ paddingHorizontal: 20 }}>
                                <TrendingUp size={24} color="#090966" />
                            </View>

                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: '#090966', fontWeight: '700', marginBottom: 2 }}>NOW</Text>
                                <Text style={{ fontSize: 28, fontWeight: '800', color: '#090966' }}>
                                    {successData?.currentStock}
                                </Text>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={{ width: '100%', gap: 12 }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#090966',
                                    paddingVertical: 16,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    width: '100%',
                                    shadowColor: '#090966',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 4
                                }}
                                onPress={handleBackToScanner}
                            >
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>
                                    Scan Next Product
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    width: '100%'
                                }}
                                onPress={handleDone}
                            >
                                <Text style={{ fontSize: 16, fontWeight: '600', color: '#4B5563' }}>
                                    Done
                                </Text>
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
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#090966',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    scanFrame: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 250,
        height: 250,
        marginLeft: -125,
        marginTop: -125,
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#ffd60a',
    },
    cornerTopLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
    },
    cornerTopRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
    },
    cornerBottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
    },
    cornerBottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
    },
    instructionsContainer: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    instructionsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    permissionText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#090966',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    productModal: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1f2937',
    },
    productInfo: {
        flexDirection: 'row',
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 16,
    },
    productDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    productName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 4,
    },
    productBrand: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 8,
    },
    productPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#090966',
    },
    sizeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 12,
    },
    sizesContainer: {
        gap: 12,
    },
    sizeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#090966',
        borderRadius: 12,
        padding: 16,
    },
    sizeButtonDisabled: {
        backgroundColor: '#f3f4f6',
        borderColor: '#d1d5db',
    },
    sizeButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#090966',
        flex: 1,
    },
    sizeButtonTextDisabled: {
        color: '#9ca3af',
    },
    stockText: {
        fontSize: 14,
        color: '#6b7280',
        marginRight: 12,
    },
    stockTextDisabled: {
        color: '#d1d5db',
    },
    minusButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    minusButtonText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    minusButtonText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    selectedSizeButton: {
        borderColor: '#090966',
        backgroundColor: '#EFF6FF',
        borderWidth: 2,
    },
    confirmButton: {
        marginTop: 24,
        backgroundColor: '#090966',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    confirmButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    noVariantsText: {
        fontSize: 14,
        color: '#6b7280',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12
    },
    qtyButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BFDBFE'
    },
    qtyText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#090966',
        marginHorizontal: 16,
        minWidth: 24,
        textAlign: 'center'
    },
    successBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    successModal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
    },
    successIconContainer: {
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 20,
    },
    successInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    successProductName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6b7280',
    },
    successStockRow: {
        backgroundColor: '#f0f9ff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    successStockText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0369a1',
    },
    trustPointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#090966',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
        marginBottom: 24,
    },
    trustPointsText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffd60a',
    },
    successButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    successButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    successButtonPrimary: {
        backgroundColor: '#090966',
    },
    successButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#090966',
    },
    successButtonTextPrimary: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    successButtonTextSecondary: {
        fontSize: 16,
        fontWeight: '700',
        color: '#090966',
    },
});

export default PhysicalSaleScannerScreen;
