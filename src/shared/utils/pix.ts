export function detectPixKeyType(key: string): string {
  if (!key || key.trim() === '') return '';
  const cleanKey = key.trim();
  
  if (cleanKey.includes('@')) return 'E-mail';
  
  const digitsOnly = cleanKey.replace(/\D/g, '');
  
  // Se parece com CPF
  if (digitsOnly.length === 11 && !cleanKey.startsWith('+')) return 'CPF';
  
  // Se parece com CNPJ
  if (digitsOnly.length === 14) return 'CNPJ';
  
  // Se parece com telefone (pode começar com + ou apenas ddd e número)
  if (cleanKey.startsWith('+') || (digitsOnly.length >= 10 && digitsOnly.length <= 13)) return 'Celular';
  
  // EVP (UUID)
  if (cleanKey.length === 36 && cleanKey.includes('-')) return 'Chave Aleatória (EVP)';
  
  // Fallback genérico para EVP
  return 'Chave Aleatória (EVP)';
}

export function maskPixKey(key: string, type: string): string {
  if (!key) return '';
  const cleanKey = key.trim();
  
  const normalizedType = type.toUpperCase();
  
  if (normalizedType === 'CPF') {
    const digits = cleanKey.replace(/\D/g, '');
    if (digits.length !== 11) return cleanKey;
    return `***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**`;
  }
  if (normalizedType === 'CNPJ') {
    const digits = cleanKey.replace(/\D/g, '');
    if (digits.length !== 14) return cleanKey;
    return `**.***.${digits.substring(5, 8)}/${digits.substring(8, 12)}-**`;
  }
  if (normalizedType === 'E-MAIL' || normalizedType === 'EMAIL') {
    const [local, domain] = cleanKey.split('@');
    if (!domain) return cleanKey;
    return `${local.substring(0, 3)}***@${domain}`;
  }
  if (normalizedType === 'CELULAR' || normalizedType === 'TELEFONE' || normalizedType === 'PHONE') {
    if (cleanKey.length < 8) return cleanKey;
    return `${cleanKey.substring(0, 4)} ** *****-${cleanKey.substring(cleanKey.length - 4)}`;
  }
  
  // Default to EVP (UUID) masking
  if (cleanKey.length > 8) {
    return `${cleanKey.substring(0, 4)}***${cleanKey.substring(cleanKey.length - 4)}`;
  }
  return cleanKey;
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10))) return false;

  return true;
}

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const dvs = digits.substring(size);
  
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(dvs.charAt(0))) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(dvs.charAt(1))) return false;

  return true;
}

export function normalizePhoneBr(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return value.startsWith('+') ? value : `+${digits}`;
}

export function getPixValidationError(type: PixKeyType, input: string): string {
  const cleanInput = input.trim();
  if (cleanInput.length === 0) {
    return 'Chave Pix é obrigatória.';
  }

  switch (type) {
    case 'CPF': {
      const digitsOnly = cleanInput.replace(/\D/g, '');
      if (digitsOnly.length !== 11 || !isValidCpf(digitsOnly)) {
        return 'CPF inválido. Confira os números da chave Pix.';
      }
      return '';
    }
    case 'CNPJ': {
      const digitsOnly = cleanInput.replace(/\D/g, '');
      if (digitsOnly.length !== 14 || !isValidCnpj(digitsOnly)) {
        return 'CNPJ inválido. Confira os números da chave Pix.';
      }
      return '';
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanInput.toLowerCase())) {
        return 'E-mail inválido. Informe uma chave Pix de e-mail válida.';
      }
      return '';
    }
    case 'PHONE': {
      const normalized = normalizePhoneBr(cleanInput);
      const phoneRegex = /^\+55[1-9][1-9]\d{8,9}$/;
      if (!phoneRegex.test(normalized)) {
        return 'Telefone inválido. Informe com DDD, exemplo: (91) 99999-9999.';
      }
      return '';
    }
    case 'EVP': {
      const evpRegex = /^[a-zA-Z0-9-]{32,77}$/;
      if (!evpRegex.test(cleanInput)) {
        return 'Chave aleatória inválida. Confira a chave Pix copiada do seu banco.';
      }
      return '';
    }
    default:
      return 'Tipo de chave Pix desconhecido.';
  }
}

export function formatCpf(value: string): string {
  const clean = value.replace(/\D/g, '').substring(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const clean = value.replace(/\D/g, '').substring(0, 14);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  if (clean.length <= 12) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
}

export function formatPhoneBr(value: string): string {
  let clean = value.replace(/\D/g, '');
  
  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.slice(2);
  }
  
  clean = clean.substring(0, 11);
  if (clean.length === 0) return '';
  if (clean.length <= 2) return `(${clean}`;
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
}

export function normalizePixKey(type: PixKeyType, value: string): string {
  const clean = value.trim();
  if (type === 'CPF' || type === 'CNPJ') {
    return clean.replace(/\D/g, '');
  }
  if (type === 'EMAIL') {
    return clean.toLowerCase();
  }
  if (type === 'PHONE') {
    return normalizePhoneBr(clean);
  }
  return clean;
}

export function getFriendlyPixTypeLabel(type: PixKeyType): string {
  const labelMap: Record<PixKeyType, string> = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'E-mail',
    PHONE: 'Telefone',
    EVP: 'Chave Aleatória',
  };
  return labelMap[type] || type;
}



