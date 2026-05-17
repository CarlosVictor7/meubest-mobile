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
