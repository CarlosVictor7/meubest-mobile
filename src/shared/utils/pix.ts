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
  
  switch (type) {
    case 'E-mail': {
      const [local, domain] = cleanKey.split('@');
      if (!domain) return cleanKey;
      return `${local.substring(0, 3)}***@${domain}`;
    }
    case 'CPF': {
      const digits = cleanKey.replace(/\D/g, '');
      if (digits.length !== 11) return cleanKey;
      return `***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**`;
    }
    case 'CNPJ': {
      const digits = cleanKey.replace(/\D/g, '');
      if (digits.length !== 14) return cleanKey;
      return `**.***.${digits.substring(5, 8)}/${digits.substring(8, 12)}-**`;
    }
    case 'Celular': {
      if (cleanKey.length < 8) return cleanKey;
      return `${cleanKey.substring(0, 4)} ** *****-${cleanKey.substring(cleanKey.length - 4)}`;
    }
    case 'Chave Aleatória (EVP)':
    default:
      if (cleanKey.length > 8) {
        return `${cleanKey.substring(0, 4)}***${cleanKey.substring(cleanKey.length - 4)}`;
      }
      return cleanKey;
  }
}
