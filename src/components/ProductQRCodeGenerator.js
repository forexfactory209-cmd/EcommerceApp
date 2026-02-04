import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { captureRef } from 'react-native-view-shot';
import { Download, FileText, Image as ImageIcon, QrCode } from 'lucide-react-native';

const ProductQRCodeGenerator = ({ productId, productName }) => {
    const qrRef = useRef(null);
    const labelRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const getQRBase64 = () => {
        return new Promise((resolve, reject) => {
            if (qrRef.current) {
                qrRef.current.toDataURL((data) => resolve(data));
            } else {
                reject(new Error('QR Code not ready'));
            }
        });
    };

    const handleDownloadImage = async () => {
        if (!labelRef.current) return;
        setLoading(true);
        try {
            const uri = await captureRef(labelRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile'
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Save Product Label',
                    UTI: 'public.png'
                });
            } else {
                Alert.alert('Saved', 'Image saved to gallery');
            }
        } catch (error) {
            console.error('Error saving image:', error);
            Alert.alert('Error', 'Failed to generate image label');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        setLoading(true);
        try {
            const base64 = await getQRBase64();
            const safeName = String(productName || 'Product').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: 'Helvetica', sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #ffffff;
                        }
                        .label-card {
                            border: 2px solid #000;
                            border-radius: 12px;
                            padding: 40px;
                            text-align: center;
                            width: 350px;
                        }
                        .product-name {
                            font-size: 24px;
                            font-weight: bold;
                            margin-bottom: 5px;
                            color: #000;
                            word-wrap: break-word;
                        }
                        .product-id {
                            font-size: 14px;
                            color: #666;
                            margin-bottom: 25px;
                            font-family: monospace;
                        }
                        .qr-container {
                            margin: 20px auto;
                        }
                        .footer {
                            font-size: 16px;
                            color: #333;
                            margin-top: 20px;
                            font-weight: 500;
                        }
                    </style>
                </head>
                <body>
                    <div class="label-card">
                        <div class="product-name">${safeName}</div>
                        <div class="product-id">ID: ${productId}</div>
                        <div class="qr-container">
                            <img src="data:image/png;base64,${base64}" width="200" height="200" />
                        </div>
                        <div class="footer">Scan to Deduct Stock</div>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Save Label PDF',
                    UTI: 'com.adobe.pdf'
                });
            } else {
                Alert.alert('Success', 'PDF generated');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert('Error', 'Failed to generate PDF');
        } finally {
            setLoading(false);
        }
    };

    const qrValue = `ecommerceapp://product/${productId}`;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <QrCode size={20} color="#090966" />
                <Text style={styles.title}>Product QR Code</Text>
            </View>

            <Text style={styles.description}>
                Download this QR code and attach it to your physical product. Scan it during physical sales to quickly update inventory.
            </Text>

            {/* This View is captured for Image Download */}
            <View
                ref={labelRef}
                collapsable={false}
                style={styles.labelPreview}
            >
                <Text style={styles.labelProductName}>{productName}</Text>
                <Text style={styles.labelProductId}>ID: {String(productId).substring(0, 8)}...</Text>

                <View style={styles.qrWrapper}>
                    <QRCode
                        value={qrValue}
                        size={200}
                        backgroundColor="white"
                        color="#090966"
                        getRef={(ref) => (qrRef.current = ref)}
                        quietZone={10}
                    />
                </View>

                <Text style={styles.labelFooter}>Scan to Deduct Stock</Text>
            </View>

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.imageButton]}
                    onPress={handleDownloadImage}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" size="small" /> : <ImageIcon size={20} color="#FFFFFF" />}
                    <Text style={styles.actionButtonText}>Save Image</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.pdfButton]}
                    onPress={handleDownloadPDF}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" size="small" /> : <FileText size={20} color="#FFFFFF" />}
                    <Text style={styles.actionButtonText}>Save PDF</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>💡 How to use:</Text>
                <Text style={styles.infoText}>1. Download the label (PDF recommended for printing)</Text>
                <Text style={styles.infoText}>2. Attach it to your physical product</Text>
                <Text style={styles.infoText}>3. Scan it when making physical sales</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 20,
        marginVertical: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    description: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
        marginBottom: 20,
    },
    labelPreview: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    labelProductName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
    },
    labelProductId: {
        fontSize: 12,
        color: '#6b7280',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 16,
    },
    qrWrapper: {
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 8,
        overflow: 'hidden', // Ensures QR doesn't bleed if rounded
    },
    labelFooter: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    imageButton: {
        backgroundColor: '#090966',
    },
    pdfButton: {
        backgroundColor: '#EF4444', // Red for PDF
    },
    actionButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    infoBox: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e40af',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#1e40af',
        lineHeight: 20,
        marginBottom: 4,
    },
});

export default ProductQRCodeGenerator;
