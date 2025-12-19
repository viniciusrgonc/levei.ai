import { Check, X } from 'lucide-react';
import { useMemo } from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Número', test: (p) => /[0-9]/.test(p) },
  { label: 'Caractere especial (!@#$%...)', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors = passwordRules
    .filter(rule => !rule.test(password))
    .map(rule => rule.label);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    
    const passedRules = passwordRules.filter(rule => rule.test(password)).length;
    const score = (passedRules / passwordRules.length) * 100;
    
    if (score <= 20) return { score, label: 'Muito fraca', color: 'bg-destructive' };
    if (score <= 40) return { score, label: 'Fraca', color: 'bg-orange-500' };
    if (score <= 60) return { score, label: 'Média', color: 'bg-yellow-500' };
    if (score <= 80) return { score, label: 'Boa', color: 'bg-lime-500' };
    return { score, label: 'Forte', color: 'bg-green-500' };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Força da senha</span>
          <span className={`text-[10px] sm:text-xs font-medium ${
            strength.score >= 80 ? 'text-green-600' : 
            strength.score >= 60 ? 'text-lime-600' : 
            strength.score >= 40 ? 'text-yellow-600' : 
            strength.score >= 20 ? 'text-orange-600' : 'text-destructive'
          }`}>
            {strength.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strength.score}%` }}
          />
        </div>
      </div>
      
      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {passwordRules.map((rule, index) => {
          const passed = rule.test(password);
          return (
            <div 
              key={index} 
              className={`flex items-center gap-1 text-[10px] sm:text-xs transition-colors ${
                passed ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              {passed ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <X className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              )}
              <span className="truncate">{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
