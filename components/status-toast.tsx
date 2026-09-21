import { CheckCircle2, CircleAlert } from 'lucide-react';

export function StatusToast({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  return (
    <div className={`status-toast ${tone}`} role="status" aria-live="polite">
      {tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      {message}
    </div>
  );
}
