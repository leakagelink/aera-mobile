import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/ui/States';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1 }}>
          <ErrorState
            title="Aera hit a problem"
            message="The screen stopped unexpectedly. You can try it again."
            actionLabel="Try again"
            onAction={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
