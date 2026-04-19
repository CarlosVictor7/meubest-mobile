import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { User } from 'lucide-react-native';
import { colors, borderRadius } from '@constants/theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  photoURL?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
  isOnline?: boolean;
}

const sizePx: Record<AvatarSize, number> = {
  xs: 28,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 100,
};

export function Avatar({ photoURL, name, size = 'md', style, isOnline }: AvatarProps) {
  const px = sizePx[size];
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : null;

  const containerStyle: ViewStyle = {
    width: px,
    height: px,
    borderRadius: px / 2,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...style,
  };

  return (
    <View style={{ position: 'relative' }}>
      <View style={containerStyle}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={{ width: px, height: px }} />
        ) : initials ? (
          <Text style={[styles.initials, { fontSize: px * 0.35, color: colors.primary }]}>
            {initials}
          </Text>
        ) : (
          <User size={px * 0.5} color={colors.primary} />
        )}
      </View>
      {isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: px * 0.28,
              height: px * 0.28,
              borderRadius: px * 0.14,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: {
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
