import React, { useRef, useEffect } from 'react';
import {
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    ActivityIndicator,
    View,
    Pressable,
    Platform
} from 'react-native';
import { Check } from 'lucide-react-native';

const BeegsoButton = ({
    onPress,
    loading,
    success,
    label,
    icon: Icon,
    disabled,
    style,
    textStyle,
    iconSize = 20,
    brandColor = '#090966',
    successColor = '#10B981',
    backgroundColor: backgroundColorProp,
    contentColor,
    rippleColor
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const elevation = useRef(new Animated.Value(8)).current;
    const successAnim = useRef(new Animated.Value(0)).current;
    const enabledAnim = useRef(new Animated.Value(disabled ? 0 : 1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const glowTranslateX = useRef(new Animated.Value(-200)).current;

    useEffect(() => {
        if (success) {
            Animated.spring(successAnim, {
                toValue: 1,
                useNativeDriver: false,
                friction: 8,
                tension: 40
            }).start();
        } else {
            successAnim.setValue(0);
        }
    }, [success]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(enabledAnim, {
                toValue: disabled ? 0.6 : 1,
                duration: 300,
                useNativeDriver: false,
            }),
            Animated.timing(scale, {
                toValue: disabled ? 0.98 : 1,
                duration: 300,
                useNativeDriver: false,
            })
        ]).start();

        if (!disabled) {
            // Glow sweep animation
            Animated.parallel([
                Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
                Animated.timing(glowTranslateX, { toValue: 200, duration: 400, useNativeDriver: false })
            ]).start();
        } else {
            // Reset glow values when disabled
            glowAnim.stopAnimation();
            glowTranslateX.stopAnimation();
            Animated.parallel([
                Animated.timing(glowAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
                Animated.timing(glowTranslateX, { toValue: -200, duration: 0, useNativeDriver: false })
            ]).start();
        }
    }, [disabled]);

    const handlePressIn = () => {
        if (disabled || loading || success) return;
        Animated.parallel([
            Animated.spring(scale, { toValue: 0.95, useNativeDriver: false, friction: 8 }),
            Animated.spring(elevation, { toValue: 2, useNativeDriver: false })
        ]).start();
    };

    const handlePressOut = () => {
        if (disabled || loading || success) return;
        Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 8 }),
            Animated.spring(elevation, { toValue: 8, useNativeDriver: false })
        ]).start();
    };

    const backgroundColor = successAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [backgroundColorProp || brandColor, successColor]
    });

    const resolvedContentColor = contentColor || (backgroundColorProp ? brandColor : 'white');

    const shadowOpacity = elevation.interpolate({
        inputRange: [2, 8],
        outputRange: [0.1, 0.35]
    });

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading || success}
            android_ripple={
                Platform.OS === 'android'
                    ? {
                        color: rippleColor || 'rgba(9, 9, 102, 0.12)',
                        borderless: false,
                      }
                    : undefined
            }
            style={{ width: '100%' }}
        >
            <Animated.View
                style={[
                    styles.button,
                    style,
                    {
                        transform: [{ scale }],
                        backgroundColor,
                        shadowOpacity,
                        elevation: elevation,
                        opacity: enabledAnim
                    }
                ]}
            >
                {loading ? (
                    <ActivityIndicator color="white" size="small" />
                ) : success ? (
                    <Animated.View style={{ transform: [{ scale: successAnim }] }}>
                        <Check size={24} color="white" />
                    </Animated.View>
                ) : (
                    <View style={styles.content}>
                        <Text style={[styles.text, { color: resolvedContentColor }, textStyle]}>{label}</Text>
                        {Icon && <Icon size={iconSize} color={resolvedContentColor} style={styles.icon} />}
                    </View>
                )}

                {/* Glow Sweep Overlay */}
                <Animated.View
                    style={[
                        styles.glow,
                        {
                            opacity: glowAnim,
                            transform: [{
                                translateX: glowTranslateX
                            }]
                        }
                    ]}
                />
            </Animated.View>
        </Pressable>
    );
};

const width = 400; // Approx

const styles = StyleSheet.create({
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        overflow: 'hidden',
        position: 'relative'
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    icon: {
        marginLeft: 8,
    },
    glow: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '25deg' }]
    }
});

export default BeegsoButton;
