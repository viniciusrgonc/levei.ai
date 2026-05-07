import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RatingModal } from '@/components/RatingModal';
import { supabase } from '@/integrations/supabase/client';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [{ rating: 5 }], error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const defaultProps = {
  deliveryId: 'delivery-abc',
  raterRole: 'restaurant' as const,
  targetUserId: 'driver-user-456',
  targetName: 'João Silva',
  onClose: vi.fn(),
  onSubmitted: vi.fn(),
};

function renderModal(overrides = {}) {
  return render(<RatingModal {...defaultProps} {...overrides} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RatingModal — render', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSubmitted.mockReset();
  });

  it('shows the target name', () => {
    renderModal();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });

  it('shows restaurant→driver title when raterRole is restaurant', () => {
    renderModal({ raterRole: 'restaurant' });
    expect(screen.getByText('Como foi a entrega?')).toBeInTheDocument();
  });

  it('shows driver→restaurant title when raterRole is driver', () => {
    renderModal({ raterRole: 'driver' });
    expect(screen.getByText('Como foi o estabelecimento?')).toBeInTheDocument();
  });

  it('renders 5 star buttons', () => {
    renderModal();
    const starButtons = screen.getAllByRole('button', { name: /estrelas?/i });
    expect(starButtons).toHaveLength(5);
  });

  it('submit button is disabled when no star is selected', () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /enviar avaliação/i });
    expect(submitBtn).toBeDisabled();
  });

  it('renders "Avaliar depois" dismiss button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /avaliar depois/i })).toBeInTheDocument();
  });
});

describe('RatingModal — star interaction', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSubmitted.mockReset();
  });

  it('enables submit button after clicking a star', async () => {
    renderModal();
    const star3 = screen.getByRole('button', { name: '3 estrelas' });
    await userEvent.click(star3);
    const submitBtn = screen.getByRole('button', { name: /enviar avaliação/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows label "Excelente!" when 5 stars selected', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    expect(screen.getByText('Excelente!')).toBeInTheDocument();
  });

  it('shows label "Muito ruim" when 1 star selected', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: '1 estrelas' }));
    expect(screen.getByText('Muito ruim')).toBeInTheDocument();
  });

  it('shows label "Regular" when 3 stars selected', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: '3 estrelas' }));
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('shows comment textarea after selecting any star', async () => {
    renderModal();
    expect(screen.queryByPlaceholderText(/comentário|problema/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '4 estrelas' }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('RatingModal — tag sections', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSubmitted.mockReset();
  });

  it('shows positive tags (driver tags) for restaurant rater with 4+ stars', async () => {
    renderModal({ raterRole: 'restaurant' });
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    expect(screen.getByText('Rápido')).toBeInTheDocument();
    expect(screen.getByText('Pontual')).toBeInTheDocument();
  });

  it('shows positive tags (restaurant tags) for driver rater with 4+ stars', async () => {
    renderModal({ raterRole: 'driver' });
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    expect(screen.getByText('Organizado')).toBeInTheDocument();
    expect(screen.getByText('Pedido pronto')).toBeInTheDocument();
  });

  it('shows negative reasons for low rating (1 star)', async () => {
    renderModal({ raterRole: 'restaurant' });
    await userEvent.click(screen.getByRole('button', { name: '1 estrelas' }));
    expect(screen.getByText('Atraso')).toBeInTheDocument();
    expect(screen.getByText('Produto danificado')).toBeInTheDocument();
  });

  it('does NOT show positive tags for neutral rating (3 stars)', async () => {
    renderModal({ raterRole: 'restaurant' });
    await userEvent.click(screen.getByRole('button', { name: '3 estrelas' }));
    expect(screen.queryByText('Rápido')).not.toBeInTheDocument();
    expect(screen.queryByText('Atraso')).not.toBeInTheDocument();
  });

  it('resets selected tags when star changes', async () => {
    renderModal({ raterRole: 'restaurant' });
    // Select 5 stars, pick a tag
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    await userEvent.click(screen.getByText('Rápido'));
    // Switch to 1 star — positive tags gone, negative shown
    await userEvent.click(screen.getByRole('button', { name: '1 estrelas' }));
    expect(screen.queryByText('Rápido')).not.toBeInTheDocument();
  });
});

describe('RatingModal — dismiss / close', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSubmitted.mockReset();
  });

  it('calls onClose when "Avaliar depois" is clicked', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /avaliar depois/i }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    renderModal();
    // The backdrop is the outer fixed div — fire click directly on it
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!, { target: backdrop });
    // Note: jsdom simulates event.target === event.currentTarget when clicked directly
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe('RatingModal — submit', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSubmitted.mockReset();
    vi.clearAllMocks();

    // Reset supabase mock to a successful flow
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [{ rating: 5 }], error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });
  });

  it('shows success screen after valid submission', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() => {
      expect(screen.getByText('Obrigado pelo feedback!')).toBeInTheDocument();
    });
  });

  it('calls onSubmitted when "Fechar" is clicked on success screen', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: '5 estrelas' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() => screen.getByText('Obrigado pelo feedback!'));
    await userEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(defaultProps.onSubmitted).toHaveBeenCalledOnce();
  });
});
