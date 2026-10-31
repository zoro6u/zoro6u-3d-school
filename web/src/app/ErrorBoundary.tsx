import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Rendered instead of the children after an error. `reset` clears the error and retries. */
  fallback: (reset: () => void, error: Error) => ReactNode;
  children: ReactNode;
  /** Changing this value also clears the error (e.g. a route or a quality setting). */
  resetKey?: unknown;
}

/** Keeps one failing component (usually the WebGL canvas) from blanking the whole app. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error caught by boundary:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.reset, this.state.error) : this.props.children;
  }
}
