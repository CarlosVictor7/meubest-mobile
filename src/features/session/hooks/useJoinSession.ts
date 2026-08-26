/**
 * useJoinSession — o botão ENTRAR de qualquer lista/detalhe.
 *
 * Sessão agendada passa pelo `POST /sessions/:id/join` ANTES de abrir o
 * VideoRoom: é a API que valida a janela (−15/+30 min) e grava
 * `joinedAt.{uid}`/`startedAt`. Um 409 vira mensagem, e a sala NÃO abre.
 * Imediatas entram direto, como sempre.
 */
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { prepareJoin } from '../services/scheduling';

export function useJoinSession() {
  const navigation = useNavigation<any>();
  const [joining, setJoining] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const join = useCallback(
    async (session: { id: string; type?: string }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setJoining(session.id);
      try {
        await prepareJoin(session);
        navigation.navigate('Session', { sessionId: session.id });
      } catch (err: any) {
        Alert.alert(
          'Não foi possível entrar',
          err?.message || 'Tente novamente em instantes.'
        );
      } finally {
        inFlightRef.current = false;
        setJoining(null);
      }
    },
    [navigation]
  );

  return { join, joining };
}
