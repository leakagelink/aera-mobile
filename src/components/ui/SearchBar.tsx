import { Search } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { font, radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  value?: string;
  placeholder: string;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
};

export function SearchBar({ value, placeholder, onChangeText, onPress, autoFocus = false, editable = true }: Props) {
  const theme = useTheme();
  const field = (
    <View style={[styles.bar, { backgroundColor: theme.colors.nav, borderColor: editable ? `${theme.colors.primary}66` : theme.colors.glassBorder }]}>
      <Search color={editable ? theme.colors.primary : theme.colors.mutedForeground} size={20} />
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedForeground}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          style={[styles.input, { color: theme.colors.foreground, fontFamily: font.medium }]}
          accessibilityLabel={placeholder}
        />
      ) : (
        <AppText weight="medium" size={15} style={styles.placeholder}>
          {placeholder}
        </AppText>
      )}
    </View>
  );

  if (!editable && onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={placeholder} onPress={onPress}>
        {field}
      </Pressable>
    );
  }
  return field;
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  placeholder: {
    flex: 1,
  },
});
