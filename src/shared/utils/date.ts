/**
 * Converte createdAt / paidAt / requestedAt (Timestamp | string | Date) em string pt-BR formatada
 */
export function formatTransactionDate(raw: unknown): string {
  if (!raw) return 'Data não disponível';
  
  let date: Date | null = null;
  
  if (raw instanceof Date) {
    date = raw;
  } else if (typeof raw === 'object' && raw !== null) {
    if ('toDate' in raw && typeof (raw as any).toDate === 'function') {
      date = (raw as any).toDate();
    } else if ('seconds' in raw && typeof (raw as any).seconds === 'number') {
      date = new Date((raw as any).seconds * 1000);
    } else if ('_seconds' in raw && typeof (raw as any)._seconds === 'number') {
      date = new Date((raw as any)._seconds * 1000);
    }
  } else if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      date = d;
    }
  }
  
  if (!date || isNaN(date.getTime())) {
    return 'Data não disponível';
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}

/**
 * Retorna o melhor campo de data para a transação de acordo com o tipo e regras de negócio
 */
export function getTransactionDate(tx: any): any {
  if (!tx) return null;
  
  if (tx.type === 'tip_received' || tx.type === 'tip_sent') {
    return tx.paidAt || tx.createdAt || tx.updatedAt;
  }
  
  if (tx.type === 'withdrawal') {
    if (tx.status === 'completed' || tx.status === 'paid') {
      return tx.completedAt || tx.paidAt || tx.updatedAt || tx.requestedAt || tx.createdAt;
    }
    return tx.requestedAt || tx.createdAt || tx.updatedAt;
  }
  
  return tx.createdAt || tx.updatedAt;
}
