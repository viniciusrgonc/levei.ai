import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-gray-900">Algo deu errado</h1>
            <p className="text-sm text-gray-500">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <p className="text-xs font-mono text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2 text-left break-all">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm"
            >
              Recarregar
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.href = '/';
              }}
              className="w-full h-12 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-sm"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Wrapper funcional para uso inline em telas específicas */
export function PageError({
  message = 'Não foi possível carregar esta página.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-800">Erro ao carregar</p>
        <p className="text-xs text-gray-500">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-10 px-6 rounded-xl bg-primary text-white font-semibold text-sm"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
