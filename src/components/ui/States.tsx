import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { useTheme } from '@/theme/useTheme';

type LoadingProps = {
  title?: string;
  message?: string;
};

export function LoadingState({ title = 'Loading', message = 'This will only take a moment.' }: LoadingProps) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <AppText size={22} weight="semibold">
        {title}
      </AppText>
      <AppText size={14} color={theme.colors.mutedForeground} style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

type ErrorProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function ErrorState({ title, message, actionLabel, onAction, secondaryLabel, onSecondary }: ErrorProps) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <AppText size={24} weight="semibold" style={styles.title}>
        {title}
      </AppText>
      <AppText size={15} color={theme.colors.mutedForeground} style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <PrimaryButton onPress={onAction} style={styles.button}>
          {actionLabel}
        </PrimaryButton>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <SecondaryButton onPress={onSecondary} style={styles.button}>
          {secondaryLabel}
        </SecondaryButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  title: { textAlign: 'center' },
  message: { marginTop: 8, textAlign: 'center', lineHeight: 22 },
  button: { marginTop: 16, alignSelf: 'stretch' },
});
