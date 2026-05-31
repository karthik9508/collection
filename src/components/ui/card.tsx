import React from 'react';
import { StyleSheet, View, ViewProps, Pressable } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export type CardProps = ViewProps & {
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
};

export function Card({ style, children, onPress, variant = 'default', ...props }: CardProps) {
  const theme = useTheme();

  const containerStyle = [
    styles.card,
    { backgroundColor: theme.backgroundElement },
    variant === 'elevated' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
    },
    variant === 'outlined' && {
      borderWidth: 1,
      borderColor: theme.backgroundSelected,
    },
    variant === 'glass' && {
      backgroundColor: theme.background === '#ffffff' ? 'rgba(240, 240, 243, 0.8)' : 'rgba(33, 34, 37, 0.8)',
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [containerStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.header, style]} {...props}>
      {children}
    </View>
  );
}

export function CardContent({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.content, style]} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.footer, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginVertical: Spacing.one,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  header: {
    marginBottom: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
  },
  footer: {
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
});
